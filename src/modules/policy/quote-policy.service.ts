import { Injectable } from '@nestjs/common';
import type {
  PolicyBreach,
  PolicyEvaluation,
  PolicyLineInput,
  PolicyRuleSet,
} from './interfaces/policy.interfaces';

/** Rounds a percent to one decimal place so the observed value is stable across runs. */
function pct1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Pure, deterministic policy gate (US-E4-2 FR-1). It flags margin-floor and max-discount breaches
 * unconditionally: it never sees match confidence, so a breach is reported regardless of how
 * confident matching was. Boundaries are inclusive: a discount exactly equal to the max, or a
 * margin exactly equal to the floor, is allowed (EC-01).
 */
@Injectable()
export class QuotePolicyService {
  /** Evaluates every priced line against the margin floor and the max-discount limit. */
  evaluate(lines: PolicyLineInput[], rules: PolicyRuleSet): PolicyEvaluation {
    // EC-02: with no policy rules configured at all, fail closed and route everything to review.
    if (!rules.hasAnyRules) {
      return {
        breached: lines.length > 0,
        failClosed: true,
        breaches: [],
        flaggedLineItemIds: lines.map((l) => l.lineItemId),
      };
    }

    const breaches: PolicyBreach[] = [];
    for (const line of lines) {
      if (rules.maxDiscountPct !== null && line.basePriceMinor > 0) {
        const discountPct =
          ((line.basePriceMinor - line.unitPriceMinor) / line.basePriceMinor) * 100;
        if (discountPct > rules.maxDiscountPct) {
          breaches.push({
            lineItemId: line.lineItemId,
            type: 'max_discount',
            observedPct: pct1(discountPct),
            limitPct: rules.maxDiscountPct,
          });
        }
      }

      if (rules.marginFloorPct !== null && line.costMinor !== null) {
        if (line.unitPriceMinor > 0) {
          const marginPct = ((line.unitPriceMinor - line.costMinor) / line.unitPriceMinor) * 100;
          if (marginPct < rules.marginFloorPct) {
            breaches.push({
              lineItemId: line.lineItemId,
              type: 'margin_floor',
              observedPct: pct1(marginPct),
              limitPct: rules.marginFloorPct,
            });
          }
        } else if (line.costMinor > 0) {
          // A free or negative-priced line with a real cost is a guaranteed loss that no positive
          // margin floor can permit. Flag it explicitly (reported as a -100% margin) instead of
          // dividing by a non-positive price and silently skipping the rule.
          breaches.push({
            lineItemId: line.lineItemId,
            type: 'margin_floor',
            observedPct: pct1(-100),
            limitPct: rules.marginFloorPct,
          });
        }
      }
    }

    return {
      breached: breaches.length > 0,
      failClosed: false,
      breaches,
      flaggedLineItemIds: [...new Set(breaches.map((b) => b.lineItemId))],
    };
  }
}
