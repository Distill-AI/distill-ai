import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { Quote } from '@modules/quotes/entities/quote.entity';
import { QuoteLineItem } from '@modules/quotes/entities/quote-line-item.entity';
import { QuoteModelAction, type QuoteLineInput } from '@modules/quotes/quote.model-action';
import { PricingRuleModelAction } from './pricing-rule.model-action';
import { QuotePricingService } from './quote-pricing.service';
import { PRICING_BLOCKED_FLAG } from './pricing.constants';
import type { PricedLine, PricingLineInput } from './interfaces/pricing.interfaces';

/** Marks a line whose unit price the estimator set manually; recompute keeps it instead of re-pricing. */
export const MANUAL_OVERRIDE_FLAG = 'manual_override';

/** Server-confirmed quote totals from a recompute. `blocked` is the EC-04 no-applicable-rule case. */
export interface RecomputeResult {
  quoteId: string | null;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  leadTimeDays: number | null;
  blocked: boolean;
}

const EMPTY_RESULT: RecomputeResult = {
  quoteId: null,
  subtotalMinor: 0,
  discountMinor: 0,
  totalMinor: 0,
  leadTimeDays: null,
  blocked: false,
};

/**
 * Re-prices a request's matched lines and replaces its quote, all within the caller's transaction
 * (`em`) so a re-map's line update, the recompute, and the status change commit or roll back together
 * (US-E6-2-BE FR-2). Reads and deletes are org-scoped, so it only ever touches the given org. It
 * reuses the pure US-E4-1 PricingService and receives no ToolRegistry, so a recompute can never be
 * steered by model output (SEC-02). Manually overridden lines keep their unit price; the rest are
 * rule-priced.
 */
@Injectable()
export class QuoteRecomputeService {
  constructor(
    private readonly pricingRules: PricingRuleModelAction,
    private readonly pricing: QuotePricingService,
    private readonly quotes: QuoteModelAction,
  ) {}

  /** Recomputes and persists the quote for a request inside the caller's transaction. */
  async recompute(requestId: string, orgId: string, em: EntityManager): Promise<RecomputeResult> {
    const lines = await em.find(LineItem, {
      where: { request_id: requestId, request: { org_id: orgId } },
      relations: { matched_sku: true },
      order: { position: 'ASC' },
    });

    const priceable = lines.filter(
      (li) => li.matched_sku !== null && li.quantity !== null && li.quantity > 0,
    );
    if (priceable.length === 0) {
      // Nothing priceable: drop any stale quote. Scoped by (request_id, org_id) so a mismatched
      // request/org pair can never delete another org's quote (defence in depth).
      const existing = await em.find(Quote, { where: { request_id: requestId, org_id: orgId } });
      if (existing.length > 0) {
        await em.delete(QuoteLineItem, { quote_id: In(existing.map((q) => q.id)) });
        await em.delete(Quote, { request_id: requestId, org_id: orgId });
      }
      return EMPTY_RESULT;
    }

    const autoInputs: PricingLineInput[] = priceable
      .filter((li) => !isOverridden(li))
      .map((li) => ({
        lineItemId: li.id,
        skuId: li.matched_sku_id as string,
        position: li.position,
        description: li.matched_sku?.name ?? li.raw_text,
        quantity: li.quantity as number,
        basePriceMinor: li.matched_sku!.base_price_minor,
        leadTimeDays: li.matched_sku!.lead_time_days,
      }));

    const rules = await this.pricingRules.getRuleSetForOrg(orgId);
    const autoPriced = this.pricing.priceQuote(autoInputs, rules);

    const overrideLines: PricedLine[] = priceable.filter(isOverridden).map((li) => {
      const unitPriceMinor = li.unit_price_minor as number;
      const quantity = li.quantity as number;
      return {
        lineItemId: li.id,
        skuId: li.matched_sku_id as string,
        position: li.position,
        description: li.matched_sku?.name ?? li.raw_text,
        quantity,
        unitPriceMinor,
        amountMinor: Math.round(unitPriceMinor * quantity),
        baseAmountMinor: Math.round(li.matched_sku!.base_price_minor * quantity),
        appliedDiscountPct: 0,
        leadTimeDays: li.matched_sku!.lead_time_days,
      };
    });

    const allLines = [...autoPriced.lines, ...overrideLines].sort(
      (a, b) => a.position - b.position,
    );
    const subtotalMinor = allLines.reduce((sum, l) => sum + l.baseAmountMinor, 0);
    const totalMinor = allLines.reduce((sum, l) => sum + l.amountMinor, 0);
    const leadDays = allLines.map((l) => l.leadTimeDays).filter((d): d is number => d !== null);
    const leadTimeDays = leadDays.length > 0 ? Math.max(...leadDays) : null;
    // Only the rule-priced lines can be blocked by a missing rule; an all-override quote never is.
    const blocked = autoPriced.blocked;

    const flagsById = new Map<string, string[]>(
      priceable.map((li) => [li.id, Array.isArray(li.flags) ? [...(li.flags as string[])] : []]),
    );
    const currency = priceable[0].matched_sku?.currency ?? 'GBP';

    await this.persistLinePrices(em, allLines, blocked, flagsById);
    const quote = await this.quotes.replaceForRequest(
      {
        requestId,
        orgId,
        quoteNumber: `Q-${requestId}`,
        subtotalMinor,
        discountMinor: subtotalMinor - totalMinor,
        totalMinor,
        leadTimeDays,
        currency,
        lines: allLines.map(toQuoteLine),
      },
      em,
    );

    return {
      quoteId: quote.id,
      subtotalMinor,
      discountMinor: subtotalMinor - totalMinor,
      totalMinor,
      leadTimeDays,
      blocked,
    };
  }

  /** Writes each line's recomputed unit price + lead time, toggling the blocked flag (EC-04). */
  private async persistLinePrices(
    em: EntityManager,
    lines: PricedLine[],
    blocked: boolean,
    flagsById: Map<string, string[]>,
  ): Promise<void> {
    for (const line of lines) {
      let flags = flagsById.get(line.lineItemId) ?? [];
      if (blocked) {
        if (!flags.includes(PRICING_BLOCKED_FLAG)) flags.push(PRICING_BLOCKED_FLAG);
      } else {
        flags = flags.filter((f) => f !== PRICING_BLOCKED_FLAG);
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
}

function isOverridden(li: LineItem): boolean {
  return (
    li.unit_price_minor !== null &&
    Array.isArray(li.flags) &&
    (li.flags as string[]).includes(MANUAL_OVERRIDE_FLAG)
  );
}

function toQuoteLine(l: PricedLine): QuoteLineInput {
  return {
    skuId: l.skuId,
    description: l.description,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    amountMinor: l.amountMinor,
    position: l.position,
  };
}
