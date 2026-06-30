import { describe, expect, it } from 'vitest';
import { QuotePricingService } from '../quote-pricing.service';
import type { PricingLineInput, PricingRuleSet } from '../interfaces/pricing.interfaces';

const service = new QuotePricingService();

function line(overrides: Partial<PricingLineInput> = {}): PricingLineInput {
  return {
    lineItemId: 'li-1',
    skuId: 'sku-1',
    position: 1,
    description: 'M6 hex bolt',
    quantity: 1,
    basePriceMinor: 1000,
    leadTimeDays: 7,
    ...overrides,
  };
}

function rules(overrides: Partial<PricingRuleSet> = {}): PricingRuleSet {
  return {
    hasAnyRules: true,
    quantityBreaks: [
      { minQty: 50, discountPct: 5 },
      { minQty: 250, discountPct: 10 },
      { minQty: 1000, discountPct: 15 },
    ],
    ...overrides,
  };
}

describe('QuotePricingService', () => {
  it('AC-01: a 500-unit line with a 250+ qty break prices at the break price', () => {
    const priced = service.priceQuote([line({ quantity: 500, basePriceMinor: 1000 })], rules());

    // 500 >= 250 -> 10% off: 1000 * 0.9 = 900 per unit.
    expect(priced.lines[0].appliedDiscountPct).toBe(10);
    expect(priced.lines[0].unitPriceMinor).toBe(900);
    expect(priced.lines[0].amountMinor).toBe(450000);
    expect(priced.subtotalMinor).toBe(500000);
    expect(priced.discountMinor).toBe(50000);
    expect(priced.totalMinor).toBe(450000);
    expect(priced.blocked).toBe(false);
  });

  it('AC-02: pricing the same input twice yields byte-identical output', () => {
    const input = [line({ quantity: 500 }), line({ lineItemId: 'li-2', quantity: 60 })];
    const first = service.priceQuote(input, rules());
    const second = service.priceQuote(input, rules());

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('EC-01: a quantity exactly on a break boundary applies that break (inclusive)', () => {
    const atBoundary = service.priceQuote([line({ quantity: 250 })], rules());
    const justBelow = service.priceQuote([line({ quantity: 249 })], rules());

    expect(atBoundary.lines[0].appliedDiscountPct).toBe(10);
    expect(justBelow.lines[0].appliedDiscountPct).toBe(5);
  });

  it('picks the largest applicable discount when several breaks match', () => {
    const priced = service.priceQuote([line({ quantity: 1000 })], rules());
    expect(priced.lines[0].appliedDiscountPct).toBe(15);
  });

  it('applies no discount when the quantity is below every break', () => {
    const priced = service.priceQuote([line({ quantity: 10, basePriceMinor: 1000 })], rules());
    expect(priced.lines[0].appliedDiscountPct).toBe(0);
    expect(priced.lines[0].unitPriceMinor).toBe(1000);
    expect(priced.totalMinor).toBe(10000);
  });

  it('EC-02: matched lines but no rules configured prices at base and blocks for review', () => {
    const priced = service.priceQuote(
      [line({ quantity: 500, basePriceMinor: 1000 })],
      rules({ hasAnyRules: false, quantityBreaks: [] }),
    );

    expect(priced.blocked).toBe(true);
    expect(priced.lines[0].unitPriceMinor).toBe(1000); // priced at base, not zero
    expect(priced.totalMinor).toBe(500000);
  });

  it('does not block an empty quote', () => {
    const priced = service.priceQuote([], rules({ hasAnyRules: false, quantityBreaks: [] }));
    expect(priced.blocked).toBe(false);
    expect(priced.totalMinor).toBe(0);
  });

  it('sums multi-line totals and reports the slowest lead time', () => {
    const priced = service.priceQuote(
      [
        line({ lineItemId: 'a', quantity: 60, basePriceMinor: 1000, leadTimeDays: 3 }),
        line({ lineItemId: 'b', quantity: 250, basePriceMinor: 2000, leadTimeDays: 14 }),
      ],
      rules(),
    );

    // a: 60 -> 5% -> 950 * 60 = 57000; b: 250 -> 10% -> 1800 * 250 = 450000
    expect(priced.totalMinor).toBe(57000 + 450000);
    expect(priced.subtotalMinor).toBe(60000 + 500000);
    expect(priced.discountMinor).toBe(priced.subtotalMinor - priced.totalMinor);
    expect(priced.leadTimeDays).toBe(14);
  });

  it('reports a null lead time when no line carries one', () => {
    const priced = service.priceQuote([line({ leadTimeDays: null })], rules());
    expect(priced.leadTimeDays).toBeNull();
  });
});
