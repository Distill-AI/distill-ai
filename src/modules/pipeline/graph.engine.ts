import { Injectable, Logger } from '@nestjs/common';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from './node-registry';
import { isInfraError } from './pipeline.errors';
import type { NodeResult } from './types';

/** Safety cap on node transitions per run, guards against a buggy node creating a cycle. */
const MAX_NODE_TRANSITIONS = 50;

/**
 * The in-process graph orchestrator (US-E8-4). Drives a request through the node graph from its
 * persisted `current_node`. Routing is deterministic (a pure function of node result + state),
 * never the LLM.
 *
 * Resumability is node-level: the next node is checkpointed BEFORE it runs, so a crash between
 * nodes loses nothing, and a crash mid-node simply re-runs that node on the next attempt.
 */
@Injectable()
export class PipelineGraphEngine {
  private readonly logger = new Logger(PipelineGraphEngine.name);

  constructor(
    private readonly nodes: NodeRegistry,
    private readonly requests: RequestModelAction,
    private readonly events: EventsService,
  ) {}

  /** Run (or resume) the pipeline for a request until it reaches a terminal state. */
  async run(requestId: string): Promise<void> {
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
        attributes: { resumed_from_node: req.current_node, reason: 'crash_recovery' },
      });
    }
    // Stamp processing_started_at (not just status): the recovery sweep keys off that timestamp,
    // so a bare setStatus(PARSING) would leave crashed runs undetectable.
    await this.requests.markProcessing(requestId);

    let node = req.current_node;
    let steps = 0;
    while (node !== CurrentNode.DONE && node !== CurrentNode.FAILED) {
      // Guard against a buggy node returning a cycle/self-loop that never terminates.
      if (++steps > MAX_NODE_TRANSITIONS) {
        this.logger.error({ event: 'pipeline_max_transitions_exceeded', requestId, node, steps });
        await this.checkpoint(requestId, CurrentNode.FAILED, node, orgId);
        return this.finalize(orgId, requestId, RequestStatus.FAILED);
      }

      // Resolve the node defensively: an unregistered node is a terminal engine error, not an
      // unhandled throw that would leave the request stuck in 'parsing' and re-enqueued forever.
      if (!this.nodes.has(node)) {
        this.logger.error({ event: 'pipeline_node_unregistered', requestId, node });
        await this.events.emit({
          eventName: 'stage.error',
          orgId,
          requestId,
          attributes: {
            node,
            escalated_to_human: false,
            error: `No node registered for "${node}"`,
          },
        });
        await this.checkpoint(requestId, CurrentNode.FAILED, node, orgId);
        return this.finalize(orgId, requestId, RequestStatus.FAILED);
      }
      const impl = this.nodes.get(node);
      await this.events.emit({ eventName: 'node.entered', orgId, requestId, attributes: { node } });

      let result: NodeResult;
      try {
        result = await impl.run({ requestId, orgId });
      } catch (err) {
        const infra = isInfraError(err);
        await this.events.emit({
          eventName: 'stage.error',
          orgId,
          requestId,
          attributes: { node, escalated_to_human: !infra, error: (err as Error).message },
        });
        if (infra) {
          await this.checkpoint(requestId, CurrentNode.FAILED, node, orgId);
          return this.finalize(orgId, requestId, RequestStatus.FAILED);
        }
        // Logical error: leave current_node on the throwing node so resume re-enters there, but
        // still emit node.exited so SSE clients see a clean close instead of a hung node.
        await this.events.emit({
          eventName: 'node.exited',
          orgId,
          requestId,
          attributes: { node, next: 'needs_review' },
        });
        return this.finalize(orgId, requestId, RequestStatus.NEEDS_REVIEW);
      }

      if (result.kind === 'clarify') {
        await this.events.emit({
          eventName: 'node.exited',
          orgId,
          requestId,
          attributes: { node, next: 'needs_clarification' },
        });
        return this.finalize(orgId, requestId, RequestStatus.NEEDS_CLARIFICATION);
      }

      const next = result.kind === 'failed' ? CurrentNode.FAILED : result.next;
      // Checkpoint the next node BEFORE it runs: this is the node-level resumability guarantee.
      await this.checkpoint(requestId, next, node, orgId);
      node = next;
    }

    await this.finalize(orgId, requestId, await this.computeTerminalStatus(requestId, node));
  }

  /** Persist the next node and emit the exit event (the checkpoint between nodes). */
  private async checkpoint(
    requestId: string,
    next: CurrentNode,
    from: CurrentNode,
    orgId: string,
  ): Promise<void> {
    await this.requests.setCurrentNode(requestId, next);
    await this.events.emit({
      eventName: 'node.exited',
      orgId,
      requestId,
      attributes: { node: from, next },
    });
  }

  private async finalize(orgId: string, requestId: string, status: RequestStatus): Promise<void> {
    await this.requests.setStatus(requestId, status);
    await this.events.emit({
      eventName: 'request.finalized',
      orgId,
      requestId,
      attributes: { status },
    });
    this.logger.log({ event: 'pipeline_finalized', requestId, status });
  }

  /** Terminal status from the end node + persisted routing. Deterministic, no LLM. */
  private async computeTerminalStatus(
    requestId: string,
    endNode: CurrentNode,
  ): Promise<RequestStatus> {
    if (endNode === CurrentNode.FAILED) {
      return RequestStatus.FAILED;
    }
    // Deliberate re-fetch (NOT the req from run()): the `score` node is the deterministic routing
    // source and writes `routing` during this run, so the value read at run() entry is still null
    // here. Reusing it would resolve every request to NEEDS_REVIEW once the real score node lands.
    const req = await this.requests.get({ identifierOptions: { id: requestId } });
    return req?.routing === RequestRouting.AUTO_ELIGIBLE
      ? RequestStatus.PRICED
      : RequestStatus.NEEDS_REVIEW;
  }
}
