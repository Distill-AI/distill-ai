import { Injectable, Logger } from '@nestjs/common';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from './node-registry';
import { isInfraError, CircuitBreakerOpenError } from './pipeline.errors';
import type { NodeResult } from './types';
import { getTimestamp } from '@common/utils/timestamp';
import { StageErrorReason } from '@constants/events.constants';
import { ATTR_NODE, ATTR_ORG_ID, ATTR_REQUEST_ID, withSpan } from '@common/telemetry/telemetry';

const MAX_NODE_TRANSITIONS = 50;

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function nodeSummary(node: CurrentNode): string {
  const summaries: Partial<Record<CurrentNode, string>> = {
    [CurrentNode.PARSE]: 'Parsed email + attachments',
    [CurrentNode.EXTRACT]: 'Extraction completed',
    [CurrentNode.CLASSIFY]: 'Request classified',
    [CurrentNode.MATCH]: 'Catalog matching completed',
    [CurrentNode.PRICE]: 'Pricing rules applied',
    [CurrentNode.POLICY]: 'Policy rules applied',
    [CurrentNode.SCORE]: 'Confidence scored',
  };
  return summaries[node] ?? `Node ${node} completed`;
}

@Injectable()
export class PipelineGraphEngine {
  private readonly logger = new Logger(PipelineGraphEngine.name);

  constructor(
    private readonly nodes: NodeRegistry,
    private readonly requests: RequestModelAction,
    private readonly events: EventsService,
  ) {}

  /**
   * Root of a request's trace: every node and tool span nests under this one, so a request's whole
   * run reads as one continuous trace (AC-01). The active context here is whatever the worker
   * extracted from the Bull job, so this span links to the API-side enqueue span across processes
   * (EC-01); with no inbound context it still traces, just as a fresh root carrying request_id (EC-02).
   */
  async run(requestId: string, reason?: string, skipExtract?: boolean): Promise<void> {
    await withSpan('pipeline.run', { [ATTR_REQUEST_ID]: requestId }, () =>
      this.runInternal(requestId, reason, skipExtract),
    );
  }

  private async runInternal(
    requestId: string,
    reason?: string,
    skipExtract?: boolean,
  ): Promise<void> {
    const startedAt = performance.now();
    const req = await this.requests.get({ identifierOptions: { id: requestId } });
    if (!req) {
      this.logger.warn({ event: 'pipeline_request_not_found', requestId });
      return;
    }
    const orgId = req.org_id;

    if (req.current_node !== CurrentNode.PARSE) {
      await this.events.emit({
        eventName: 'request.resumed',
        orgId,
        requestId,
        attributes: {
          // `type` mirrors the other stream events so the SSE client can narrow on it; the browser
          // dispatches on the `event:` line (the eventName above), which drives the resume banner.
          type: 'request.resumed',
          resumed_from_node: req.current_node,
          reason: reason ?? ResumeReason.CRASH_RECOVERY,
        },
      });
    }
    // The recovery sweep keys off processing_started_at, not status.
    // A bare setStatus(PARSING) would leave crashed runs undetectable by the sweeper.
    await this.requests.markProcessing(requestId);

    let node = req.current_node;
    let steps = 0;
    let overallStatus: 'success' | 'failed' = 'success';

    while (node !== CurrentNode.DONE && node !== CurrentNode.FAILED) {
      if (++steps > MAX_NODE_TRANSITIONS) {
        this.logger.error({ event: 'pipeline_max_transitions_exceeded', requestId, node, steps });
        await this.checkpoint(requestId, CurrentNode.FAILED);
        overallStatus = 'failed';
        return this.finalize(orgId, requestId, RequestStatus.FAILED, overallStatus, startedAt);
      }

      if (!this.nodes.has(node)) {
        this.logger.error({ event: 'pipeline_node_unregistered', requestId, node });
        overallStatus = 'failed';
        await this.checkpoint(requestId, CurrentNode.FAILED);
        return this.finalize(orgId, requestId, RequestStatus.FAILED, overallStatus, startedAt);
      }
      const impl = this.nodes.get(node);

      await this.emitNodeEntered(requestId, node, orgId);
      const nodeStartedAt = performance.now();

      if (skipExtract && node === CurrentNode.EXTRACT) {
        const nodeDuration = elapsedMs(nodeStartedAt);
        await this.emitNodeExited(
          requestId,
          node,
          'success',
          nodeDuration,
          'Skipped (valid extraction exists)',
          orgId,
        );
        await this.checkpoint(requestId, CurrentNode.CLASSIFY);
        node = CurrentNode.CLASSIFY;
        continue;
      }

      let result: NodeResult;
      try {
        result = await withSpan(
          `node.${node}`,
          { [ATTR_REQUEST_ID]: requestId, [ATTR_ORG_ID]: orgId, [ATTR_NODE]: node },
          () => impl.run({ requestId, orgId }),
        );
      } catch (err) {
        // Circuit breaker open (FR-5, SEC-02): LlmClientService emits stage.error before
        // throwing, so no duplicate event is needed here. Wired ahead of ClassifyNode
        // switching from LLMProvider to LlmClientService (planned LlmModule milestone).
        if (err instanceof CircuitBreakerOpenError) {
          await this.events.emit({
            eventName: 'node.exited',
            orgId,
            requestId,
            attributes: { node, next: 'needs_review' },
          });
          overallStatus = 'failed';
          return this.finalize(
            orgId,
            requestId,
            RequestStatus.NEEDS_REVIEW,
            overallStatus,
            startedAt,
          );
        }

        const infra = isInfraError(err);
        const nodeDuration = elapsedMs(nodeStartedAt);
        const errorMsg = (err as Error).message;

        if (infra) {
          await this.emitNodeExited(requestId, node, 'failed', nodeDuration, errorMsg, orgId);
          overallStatus = 'failed';
          await this.checkpoint(requestId, CurrentNode.FAILED);
          return this.finalize(orgId, requestId, RequestStatus.FAILED, overallStatus, startedAt);
        }

        await this.events.emit({
          eventName: 'stage.error',
          orgId,
          requestId,
          attributes: { stage: node, escalated_to_human: true, reason: StageErrorReason.UNKNOWN },
        });
        await this.emitNodeExited(requestId, node, 'failed', nodeDuration, errorMsg, orgId);
        overallStatus = 'failed';
        return this.finalize(
          orgId,
          requestId,
          RequestStatus.NEEDS_REVIEW,
          overallStatus,
          startedAt,
        );
      }

      const nodeDuration = elapsedMs(nodeStartedAt);
      const summary = nodeSummary(node);

      if (result.kind === 'clarify') {
        await this.emitNodeExited(
          requestId,
          node,
          'failed',
          nodeDuration,
          'Clarification requested',
          orgId,
        );
        overallStatus = 'failed';
        return this.finalize(
          orgId,
          requestId,
          RequestStatus.NEEDS_CLARIFICATION,
          overallStatus,
          startedAt,
        );
      }

      if (result.kind === 'failed') {
        await this.emitNodeExited(
          requestId,
          node,
          'failed',
          nodeDuration,
          result.error.message,
          orgId,
        );
        overallStatus = 'failed';
        await this.checkpoint(requestId, CurrentNode.FAILED);
        return this.finalize(orgId, requestId, RequestStatus.FAILED, overallStatus, startedAt);
      }

      await this.emitNodeExited(requestId, node, 'success', nodeDuration, summary, orgId);
      await this.checkpoint(requestId, result.next);
      node = result.next;
    }

    const terminalStatus = await this.computeTerminalStatus(requestId, node);
    await this.finalize(orgId, requestId, terminalStatus, overallStatus, startedAt);
  }

  private async emitNodeEntered(
    requestId: string,
    node: CurrentNode,
    orgId: string,
  ): Promise<void> {
    await this.events.emit({
      eventName: 'node.entered',
      orgId,
      requestId,
      attributes: {
        type: 'node.entered',
        timestamp: getTimestamp(),
        node,
        status: 'processing',
      },
    });
  }

  private async emitNodeExited(
    requestId: string,
    node: CurrentNode,
    status: 'success' | 'failed',
    durationMs: number,
    summary: string,
    orgId: string,
  ): Promise<void> {
    await this.events.emit({
      eventName: 'node.exited',
      orgId,
      requestId,
      attributes: {
        type: 'node.exited',
        timestamp: getTimestamp(),
        node,
        status,
        duration_ms: durationMs,
        summary,
      },
    });
  }

  private async checkpoint(requestId: string, next: CurrentNode): Promise<void> {
    await this.requests.setCurrentNode(requestId, next);
  }

  private async finalize(
    orgId: string,
    requestId: string,
    status: RequestStatus,
    overallStatus: 'success' | 'failed',
    startedAt: number,
  ): Promise<void> {
    await this.requests.setStatus(requestId, status);

    const totalDurationMs = elapsedMs(startedAt);

    await this.events.emit({
      eventName: 'processing.complete',
      orgId,
      requestId,
      attributes: {
        type: 'processing.complete',
        timestamp: getTimestamp(),
        status: overallStatus,
        total_duration_ms: totalDurationMs,
      },
    });

    await this.events.emit({
      eventName: 'request.finalized',
      orgId,
      requestId,
      attributes: { status },
    });

    this.logger.log({ event: 'pipeline_finalized', requestId, status });
  }

  private async computeTerminalStatus(
    requestId: string,
    endNode: CurrentNode,
  ): Promise<RequestStatus> {
    if (endNode === CurrentNode.FAILED) {
      return RequestStatus.FAILED;
    }
    // Deliberate re-fetch: the score node writes routing during this run.
    // The req loaded at run() entry still has routing: null here.
    const req = await this.requests.get({ identifierOptions: { id: requestId } });
    return req?.routing === RequestRouting.AUTO_ELIGIBLE
      ? RequestStatus.PRICED
      : RequestStatus.NEEDS_REVIEW;
  }
}
