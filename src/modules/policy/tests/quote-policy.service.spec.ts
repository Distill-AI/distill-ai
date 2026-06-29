import { describe, expect, it } from 'vitest';
import { QuotePolicyService } from '../quote-policy.service';
import type { PolicyLineInput, PolicyRuleSet } from '../interfaces/policy.interfaces';

const service = new QuotePolicyService();

function line(overrides: Partial<PolicyLineInput> = {}): PolicyLineInput {
  return {
    lineItemId: 'li-1',
    basePriceMinor: 1000,
    unitPriceMinor: 1000,
    costMinor: 700,
    ...overrides,
  };
}

const RULES: PolicyRuleSet = { marginFloorPct: 15, maxDiscountPct: 20, hasAnyRules: true };

describe('QuotePolicyService', () => {
  it('AC-01: flags a margin-floor breach unconditionally (no confidence input at all)', () => {
    // unit 1000, cost 900 -> margin 10% < 15% floor. The service never sees match confidence.
    const result = service.evaluate([line({ unitPriceMinor: 1000, costMinor: 900 })], RULES);
    expect(result.breached).toBe(true);
    expect(result.breaches).toEqual([
      expect.objectContaining({ type: 'margin_floor', observedPct: 10, limitPct: 15 }),
    ]);
    expect(result.flaggedLineItemIds).toEqual(['li-1']);
  });

  it('AC-02: a 35% discount against a 20% max flags a max_discount breach', () => {
    const result = service.evaluate([line({ basePriceMinor: 1000, unitPriceMinor: 650 })], RULES);
    expect(result.breaches).toContainEqual(
      expect.objectContaining({ type: 'max_discount', observedPct: 35, limitPct: 20 }),
    );
  });

  it('EC-01: a discount exactly equal to the max is allowed (inclusive boundary)', () => {
    // 20% discount, cost 700 keeps margin at 12.5%? no: unit 800, cost 700 -> margin 12.5% < 15.
    // Use cost that keeps margin healthy so only the discount boundary is under test.
    const result = service.evaluate(
      [line({ basePriceMinor: 1000, unitPriceMinor: 800, costMinor: 600 })],
      RULES,
    );
    expect(result.breaches.find((b) => b.type === 'max_discount')).toBeUndefined();
  });

  it('EC-01: a margin exactly equal to the floor is allowed (inclusive boundary)', () => {
    // unit 1000, cost 850 -> margin 15% == floor, no discount.
    const result = service.evaluate([line({ unitPriceMinor: 1000, costMinor: 850 })], RULES);
    expect(result.breached).toBe(false);
  });

  it('EC-02: with no rules configured, fails closed and flags every line for review', () => {
    const result = service.evaluate([line(), line({ lineItemId: 'li-2' })], {
      marginFloorPct: null,
      maxDiscountPct: null,
      hasAnyRules: false,
    });
    expect(result.failClosed).toBe(true);
    expect(result.breached).toBe(true);
    expect(result.flaggedLineItemIds).toEqual(['li-1', 'li-2']);
  });

  it('EC-03: a line breaching both limits records both flags against one line', () => {
    // 40% discount (>20) and margin (600-580)/600 = 3.3% (<15).
    const result = service.evaluate(
      [line({ basePriceMinor: 1000, unitPriceMinor: 600, costMinor: 580 })],
      RULES,
    );
    const types = result.breaches.map((b) => b.type).sort();
    expect(types).toEqual(['margin_floor', 'max_discount']);
    expect(result.flaggedLineItemIds).toEqual(['li-1']);
  });

  it('skips the margin check when the SKU has no cost basis', () => {
    const result = service.evaluate([line({ unitPriceMinor: 1000, costMinor: null })], RULES);
    expect(result.breaches.find((b) => b.type === 'margin_floor')).toBeUndefined();
  });

  it('reports no breach for a healthy line within both limits', () => {
    const result = service.evaluate(
      [line({ basePriceMinor: 1000, unitPriceMinor: 950, costMinor: 700 })],
      RULES,
    );
    expect(result.breached).toBe(false);
    expect(result.flaggedLineItemIds).toEqual([]);
  });
});
