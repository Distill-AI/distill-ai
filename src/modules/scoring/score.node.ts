import { Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { PRICING_BLOCKED_FLAG } from '@modules/pricing/pricing.constants';
import {
  MARGIN_FLOOR_BREACH_FLAG,
  MAX_DISCOUNT_BREACH_FLAG,
  POLICY_BLOCKED_FLAG,
} from '@modules/policy/policy.constants';
import { ScorerService } from './scorer.service';
import { ScoringConfigService } from './scoring-config.service';
import type { ScoringResultDto } from './dto/scoring-result.dto';

/**
 * Flags from the price/policy nodes that force needs_review regardless of confidence (US-E4-2):
 * even a 99%-confidence quote is held when a deterministic gate fires. The policy gate wins.
 */
const HARD_REVIEW_FLAGS = new Set<string>([
  PRICING_BLOCKED_FLAG,
  MARGIN_FLOOR_BREACH_FLAG,
  MAX_DISCOUNT_BREACH_FLAG,
  POLICY_BLOCKED_FLAG,
]);

@Injectable()
export class ScoreNode implements PipelineNode {
  readonly name = CurrentNode.SCORE;
  private readonly nextNode = CurrentNode.DONE;
  private readonly logger = new Logger(ScoreNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly scorer: ScorerService,
    private readonly scoringConfig: ScoringConfigService,
    private readonly requests: RequestModelAction,
    private readonly extractions: ExtractionModelAction,
    private readonly lineItems: LineItemModelAction,
    private readonly events: EventsService,
  ) {
    registry.register(this);
  }

  /** Writes deterministic routing from extraction validity and line-item scoring - no LLM access */
  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;
    const start = Date.now();

    const req = await this.requests.get({
      identifierOptions: { id: requestId, org_id: orgId },
    });
    if (!req) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }

    const extraction = await this.extractions.findByRequestId(requestId, orgId);

    if (!extraction?.schema_valid) {
      const scored = this.scorer.scoreExtractionFailure(extraction);

      return this.persistAndEmit(scored, requestId, orgId, start);
    }

    const lineItemRows = await this.lineItems.find({
      findOptions: { request_id: requestId, request: { org_id: orgId } },
      transactionOptions: { useTransaction: false },
    });

    const thresholds = {
      autoThreshold: this.scoringConfig.getAutoThreshold(),
      autoSendCapMinor: this.scoringConfig.getAutoSendCapMinor(),
    };

    const scored = this.scorer.score(
      lineItemRows.payload.map((li) => ({
        matchConfidence: li.match_confidence,
        unitPriceMinor: li.unit_price_minor,
        quantity: li.quantity,
        hasFlags: Array.isArray(li.flags) && (li.flags as string[]).some((f) => f !== 'close_tie'),
      })),
      thresholds,
    );

    const gated = this.applyPolicyGate(scored, lineItemRows.payload);
    return this.persistAndEmit(gated, requestId, orgId, start);
  }

  /**
   * The deterministic gate (US-E4-2): if any line carries a hard review flag from the price or
   * policy node, force needs_review regardless of the computed confidence. The policy gate wins.
   */
  private applyPolicyGate(scored: ScoringResultDto, lines: LineItem[]): ScoringResultDto {
    const hasHardFlag = lines.some(
      (li) =>
        Array.isArray(li.flags) && (li.flags as string[]).some((f) => HARD_REVIEW_FLAGS.has(f)),
    );
    if (!hasHardFlag) {
      return scored;
    }
    // Force review and annotate why, even if confidence already routed to review, so the reason
    // is recorded as a deterministic policy breach rather than only a soft confidence flag.
    const alreadyAnnotated = scored.routingReasons.some((r) => r.code === 'policy_breach');
    return {
      routing: RequestRouting.NEEDS_REVIEW,
      overallConfidence: scored.overallConfidence,
      routingReasons: alreadyAnnotated
        ? scored.routingReasons
        : [
            ...scored.routingReasons,
            { code: 'policy_breach', message: SYS_MSG.POLICY_GATE_REVIEW, source: 'policy' },
          ],
    };
  }

  private async persistAndEmit(
    scored: ScoringResultDto,
    requestId: string,
    orgId: string,
    start: number,
  ): Promise<NodeResult> {
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
