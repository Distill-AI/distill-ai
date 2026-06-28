import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { EventsService } from '@modules/events/events.service';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { QuoteModelAction, type QuoteLineInput } from '@modules/quotes/quote.model-action';
import { StageErrorReason } from '@constants/events.constants';
import * as SYS_MSG from '@constants/system-messages';
import { PricingRuleModelAction } from './pricing-rule.model-action';
import { QuotePricingService } from './quote-pricing.service';
import { PRICING_BLOCKED_FLAG } from './pricing.constants';
import type { PricedQuote, PricingLineInput } from './interfaces/pricing.interfaces';

/**
 * The price node (US-E4-1 FR-2). It is a PipelineNode with NO ToolRegistry injected: the
 * deterministic/agentic boundary is enforced by what the constructor receives, not a runtime
 * check (TRD section 6). It prices matched lines via the pure PricingService, persists the quote
 * and line prices, and advances to the policy node.
 */
@Injectable()
export class PriceNode implements PipelineNode {
  readonly name = CurrentNode.PRICE;
  private readonly nextNode = CurrentNode.POLICY;
  private readonly logger = new Logger(PriceNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly pricingRules: PricingRuleModelAction,
    private readonly pricing: QuotePricingService,
    private readonly quotes: QuoteModelAction,
    private readonly events: EventsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    registry.register(this);
  }

  /** Prices matched lines deterministically from the catalog + org rules and persists the quote - no tool access */
  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const lines = await this.dataSource.manager.find(LineItem, {
      where: { request_id: requestId },
      relations: { matched_sku: true },
      order: { position: 'ASC' },
    });

    const priceable = lines.filter(
      (li) => li.matched_sku !== null && li.quantity !== null && li.quantity > 0,
    );
    if (priceable.length === 0) {
      await this.emitCompleted(orgId, requestId, null, 0, false);
      return { kind: 'advance', next: this.nextNode };
    }

    const inputs: PricingLineInput[] = priceable.map((li) => ({
      lineItemId: li.id,
      skuId: li.matched_sku_id as string,
      position: li.position,
      description: li.matched_sku?.name ?? li.raw_text,
      quantity: li.quantity as number,
      basePriceMinor: li.matched_sku!.base_price_minor,
      leadTimeDays: li.matched_sku!.lead_time_days,
    }));

    const rules = await this.pricingRules.getRuleSetForOrg(orgId);
    const priced = this.pricing.priceQuote(inputs, rules);

    const flagsById = new Map<string, string[]>(
      priceable.map((li) => [li.id, Array.isArray(li.flags) ? [...(li.flags as string[])] : []]),
    );
    const currency = priceable[0].matched_sku?.currency ?? 'GBP';

    const quote = await this.dataSource.transaction(async (em) => {
      await this.persistLinePrices(em, priced, flagsById);
      return this.quotes.replaceForRequest(
        {
          requestId,
          orgId,
          quoteNumber: `Q-${requestId}`,
          subtotalMinor: priced.subtotalMinor,
          discountMinor: priced.discountMinor,
          totalMinor: priced.totalMinor,
          leadTimeDays: priced.leadTimeDays,
          currency,
          lines: this.toQuoteLines(priced),
        },
        em,
      );
    });

    if (priced.blocked) {
      await this.emitPricingRuleMissing(orgId, requestId);
    }
    await this.emitCompleted(orgId, requestId, quote.id, priced.totalMinor, priced.blocked);
    return { kind: 'advance', next: this.nextNode };
  }

  /** Writes the priced unit price + lead time onto each line, tagging blocked lines for review (EC-02). */
  private async persistLinePrices(
    em: EntityManager,
    priced: PricedQuote,
    flagsById: Map<string, string[]>,
  ): Promise<void> {
    for (const line of priced.lines) {
      const flags = flagsById.get(line.lineItemId) ?? [];
      if (priced.blocked && !flags.includes(PRICING_BLOCKED_FLAG)) {
        flags.push(PRICING_BLOCKED_FLAG);
      }
      await em.update(
        LineItem,
        { id: line.lineItemId },
        {
          unit_price_minor: line.unitPriceMinor,
          lead_time_days: line.leadTimeDays,
          flags: flags as unknown as object[],
        },
      );
    }
  }

  private toQuoteLines(priced: PricedQuote): QuoteLineInput[] {
    return priced.lines.map((l) => ({
      skuId: l.skuId,
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      amountMinor: l.amountMinor,
      position: l.position,
    }));
  }

  private async emitPricingRuleMissing(orgId: string, requestId: string): Promise<void> {
    try {
      await this.events.emit({
        eventName: 'stage.error',
        orgId,
        requestId,
        attributes: { stage: 'price', reason: StageErrorReason.PRICING_RULE_MISSING },
      });
    } catch (err) {
      this.logger.error(`Failed to emit stage.error for request ${requestId}`, err);
    }
  }

  private async emitCompleted(
    orgId: string,
    requestId: string,
    quoteId: string | null,
    totalMinor: number,
    blocked: boolean,
  ): Promise<void> {
    try {
      await this.events.emit({
        eventName: 'pricing.completed',
        orgId,
        requestId,
        quoteId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          total_minor: totalMinor,
          blocked,
          message: SYS_MSG.PRICE_QUOTE_PRICED(totalMinor),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit pricing.completed for request ${requestId}`, err);
    }
  }
}
