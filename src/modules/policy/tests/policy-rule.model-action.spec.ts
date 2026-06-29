import { describe, expect, it, vi } from 'vitest';
import { PricingRuleType } from '@modules/pricing/enums/pricing-rule-type.enum';
import { PolicyRuleModelAction } from '../policy-rule.model-action';

/** Builds the action over a fake repository whose find() returns the given active rule rows. */
function actionFor(rows: Array<{ rule_type: PricingRuleType; config: unknown }>) {
  const repository = { find: vi.fn().mockResolvedValue(rows) };
  return new PolicyRuleModelAction(repository as never);
}

describe('PolicyRuleModelAction.getRuleSetForOrg', () => {
  it('collapses duplicate active thresholds to the most restrictive, independent of row order', async () => {
    const rows = [
      { rule_type: PricingRuleType.MARGIN_FLOOR, config: { min_margin_pct: 10 } },
      { rule_type: PricingRuleType.MARGIN_FLOOR, config: { min_margin_pct: 20 } },
      { rule_type: PricingRuleType.MAX_DISCOUNT, config: { max_discount_pct: 30 } },
      { rule_type: PricingRuleType.MAX_DISCOUNT, config: { max_discount_pct: 15 } },
    ];

    const forward = await actionFor(rows).getRuleSetForOrg('org-1');
    const reversed = await actionFor([...rows].reverse()).getRuleSetForOrg('org-1');

    // Highest floor + lowest cap win, and the same set of rows yields the same result either way.
    expect(forward).toEqual({ marginFloorPct: 20, maxDiscountPct: 15, hasAnyRules: true });
    expect(reversed).toEqual(forward);
  });

  it('fails closed when no parseable margin-floor or max-discount rows exist', async () => {
    const ruleSet = await actionFor([
      { rule_type: PricingRuleType.QTY_BREAK, config: { min_qty: 5, discount_pct: 10 } },
      { rule_type: PricingRuleType.MARGIN_FLOOR, config: { wrong: true } },
    ]).getRuleSetForOrg('org-1');

    expect(ruleSet).toEqual({ marginFloorPct: null, maxDiscountPct: null, hasAnyRules: false });
  });
});
