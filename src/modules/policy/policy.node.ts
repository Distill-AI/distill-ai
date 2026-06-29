import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { EventsService } from '@modules/events/events.service';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import * as SYS_MSG from '@constants/system-messages';
import { PolicyRuleModelAction } from './policy-rule.model-action';
import { QuotePolicyService } from './quote-policy.service';
import {
  MARGIN_FLOOR_BREACH_FLAG,
  MAX_DISCOUNT_BREACH_FLAG,
  POLICY_BLOCKED_FLAG,
} from './policy.constants';
import type { PolicyEvaluation, PolicyLineInput } from './interfaces/policy.interfaces';

/**
 * The policy node (US-E4-2 FR-2). Like the price node it is a PipelineNode with NO ToolRegistry
 * injected, so no model-influenced call can reach a policy outcome (TRD section 6). It flags
 * margin-floor and max-discount breaches unconditionally and tags the offending lines so the
 * score node routes the quote to needs_review regardless of match confidence.
 */
@Injectable()
export class PolicyNode implements PipelineNode {
  readonly name = CurrentNode.POLICY;
  private readonly nextNode = CurrentNode.SCORE;
  private readonly logger = new Logger(PolicyNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly lineItems: LineItemModelAction,
    private readonly policyRules: PolicyRuleModelAction,
    private readonly policy: QuotePolicyService,
    private readonly events: EventsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    registry.register(this);
  }

  /** Flags margin-floor / max-discount breaches unconditionally and routes any breach to review - no tool access */
  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const { payload: lines } = await this.lineItems.list({
      filterRecordOptions: { request_id: requestId },
      relations: { matched_sku: true },
      order: { position: 'ASC' },
    });
    const priced = lines.filter((li) => li.matched_sku !== null && li.unit_price_minor !== null);
    if (priced.length === 0) {
      await this.emitCompleted(orgId, requestId, EMPTY_RESULT);
      return { kind: 'advance', next: this.nextNode };
    }

    const inputs: PolicyLineInput[] = priced.map((li) => ({
      lineItemId: li.id,
      basePriceMinor: li.matched_sku!.base_price_minor,
      unitPriceMinor: li.unit_price_minor as number,
      costMinor: li.matched_sku!.cost_minor,
    }));

    const rules = await this.policyRules.getRuleSetForOrg(orgId);
    const result = this.policy.evaluate(inputs, rules);

    if (result.breached) {
      await this.persistFlags(priced, result);
    }
    await this.emitCompleted(orgId, requestId, result);
    return { kind: 'advance', next: this.nextNode };
  }

  /** Merges breach flags onto the offending lines in one transaction (idempotent on re-run). */
  private async persistFlags(priced: LineItem[], result: PolicyEvaluation): Promise<void> {
    const flagsByLine = new Map<string, Set<string>>(
      priced.map((li) => [li.id, new Set(Array.isArray(li.flags) ? (li.flags as string[]) : [])]),
    );

    if (result.failClosed) {
      for (const id of result.flaggedLineItemIds) flagsByLine.get(id)?.add(POLICY_BLOCKED_FLAG);
    }
    for (const breach of result.breaches) {
      const flag =
        breach.type === 'margin_floor' ? MARGIN_FLOOR_BREACH_FLAG : MAX_DISCOUNT_BREACH_FLAG;
      flagsByLine.get(breach.lineItemId)?.add(flag);
    }

    await this.dataSource.transaction(async (em) => {
      for (const id of result.flaggedLineItemIds) {
        const flags = [...(flagsByLine.get(id) ?? [])];
        await em.update(LineItem, { id }, { flags: flags as unknown as object[] });
      }
    });
  }

  private async emitCompleted(
    orgId: string,
    requestId: string,
    result: PolicyEvaluation,
  ): Promise<void> {
    try {
      await this.events.emit({
        eventName: 'policy.completed',
        orgId,
        requestId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          breached: result.breached,
          fail_closed: result.failClosed,
          breach_count: result.breaches.length,
          message: result.breached
            ? SYS_MSG.POLICY_BREACH_FLAGGED(result.breaches.length)
            : SYS_MSG.POLICY_OK,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit policy.completed for request ${requestId}`, err);
    }
  }
}

const EMPTY_RESULT: PolicyEvaluation = {
  breached: false,
  failClosed: false,
  breaches: [],
  flaggedLineItemIds: [],
};
