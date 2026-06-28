import { Injectable } from '@nestjs/common';
import type {
  PricedLine,
  PricedQuote,
  PricingLineInput,
  PricingRuleSet,
  QuantityBreakRule,
} from './interfaces/pricing.interfaces';

/**
 * Pure, deterministic quote pricing (US-E4-1 FR-1). Given matched lines and the org's pricing
 * rule set, it applies the catalog base price, the inclusive quantity-break discount, and the
 * line lead time, then sums the quote totals in minor units. It performs no I/O and never reads
 * the clock, so identical input yields byte-identical output (AC-02 / EC-03).
 */
@Injectable()
export class QuotePricingService {
  /** Prices every line from its base price + the highest applicable quantity break, then totals the quote. */
  priceQuote(lines: PricingLineInput[], rules: PricingRuleSet): PricedQuote {
    const breaks = [...rules.quantityBreaks].sort((a, b) => a.minQty - b.minQty);
    const pricedLines = lines.map((line) => this.priceLine(line, breaks));

    const subtotalMinor = pricedLines.reduce((sum, l) => sum + l.baseAmountMinor, 0);
    const totalMinor = pricedLines.reduce((sum, l) => sum + l.amountMinor, 0);

    return {
      lines: pricedLines,
      subtotalMinor,
      discountMinor: subtotalMinor - totalMinor,
      totalMinor,
      leadTimeDays: this.maxLeadTime(pricedLines),
      // EC-02: matched lines but the org has no pricing rules at all -> price at base, block auto-send.
      blocked: lines.length > 0 && !rules.hasAnyRules,
    };
  }

  /** Picks the inclusive (`qty >= minQty`) break with the largest discount and applies it to one line. */
  private priceLine(line: PricingLineInput, breaks: QuantityBreakRule[]): PricedLine {
    const appliedDiscountPct = breaks
      .filter((b) => line.quantity >= b.minQty)
      .reduce((max, b) => Math.max(max, b.discountPct), 0);

    const unitPriceMinor = Math.round((line.basePriceMinor * (100 - appliedDiscountPct)) / 100);

    return {
      lineItemId: line.lineItemId,
      skuId: line.skuId,
      position: line.position,
      description: line.description,
      quantity: line.quantity,
      unitPriceMinor,
      amountMinor: Math.round(unitPriceMinor * line.quantity),
      baseAmountMinor: Math.round(line.basePriceMinor * line.quantity),
      appliedDiscountPct,
      leadTimeDays: line.leadTimeDays,
    };
  }

  /** The quote can ship no faster than its slowest matched line; null when no line carries a lead time. */
  private maxLeadTime(lines: PricedLine[]): number | null {
    const days = lines.map((l) => l.leadTimeDays).filter((d): d is number => d !== null);
    return days.length > 0 ? Math.max(...days) : null;
  }
}
