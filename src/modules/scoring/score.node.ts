import { Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { ScorerService } from './scorer.service';

@Injectable()
export class ScoreNode implements PipelineNode {
  readonly name = CurrentNode.SCORE;
  private readonly nextNode = CurrentNode.DONE;
  private readonly logger = new Logger(ScoreNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly scorer: ScorerService,
    private readonly requests: RequestModelAction,
    private readonly extractions: ExtractionModelAction,
    private readonly events: EventsService,
  ) {
    registry.register(this);
  }

  /** Writes deterministic routing from extraction validity - no LLM access */
  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;
    const start = Date.now();

    const req = await this.requests.get({
      identifierOptions: { id: requestId, org_id: orgId },
    });
    if (!req) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }

    const extraction = await this.extractions.findByRequestId(requestId);
    const scored = this.scorer.score(req, extraction);

    const updated = await this.requests.update({
      identifierOptions: { id: requestId, org_id: orgId },
      updatePayload: {
        routing: scored.routing,
        overall_confidence: scored.overallConfidence,
        routing_reasons: scored.routingReasons,
        current_node: this.nextNode,
      },
      transactionOptions: { useTransaction: false },
    });
    if (!updated) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }

    const elapsedMs = Date.now() - start;
    try {
      await this.events.emit({
        eventName: 'node.exited',
        orgId,
        requestId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          routing: scored.routing,
          overall_confidence: scored.overallConfidence,
          routing_reasons: scored.routingReasons,
          elapsed_ms: elapsedMs,
          message: SYS_MSG.SCORE_ROUTING_APPLIED(scored.routing),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit node.exited for request ${requestId}`, err);
    }

    return { kind: 'advance', next: this.nextNode };
  }
}
