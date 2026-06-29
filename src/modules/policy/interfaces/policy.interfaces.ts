/** One priced line to evaluate against policy. All money values are minor units. */
export interface PolicyLineInput {
  lineItemId: string;
  basePriceMinor: number;
  unitPriceMinor: number;
  costMinor: number | null;
}

/** The org's policy thresholds, projected from the org-scoped `pricing_rules` table. */
export interface PolicyRuleSet {
  marginFloorPct: number | null;
  maxDiscountPct: number | null;
  hasAnyRules: boolean;
}

export type PolicyBreachType = 'margin_floor' | 'max_discount';

/** A single threshold breach on one line. `observedPct` and `limitPct` are whole-number percents. */
export interface PolicyBreach {
  lineItemId: string;
  type: PolicyBreachType;
  observedPct: number;
  limitPct: number;
}

/** Outcome of policy evaluation. `failClosed` is the EC-02 "no rules configured" path. */
export interface PolicyEvaluation {
  breached: boolean;
  failClosed: boolean;
  breaches: PolicyBreach[];
  flaggedLineItemIds: string[];
}
