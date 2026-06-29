/** One matched request line ready to be priced (US-E4-1). All money values are minor units. */
export interface PricingLineInput {
  lineItemId: string;
  skuId: string;
  position: number;
  description: string;
  quantity: number;
  basePriceMinor: number;
  leadTimeDays: number | null;
}

/** A single quantity break: an inclusive `quantity >= minQty` threshold that grants `discountPct`. */
export interface QuantityBreakRule {
  minQty: number;
  discountPct: number;
}

/** The org's deterministic pricing inputs, projected from the org-scoped `pricing_rules` table. */
export interface PricingRuleSet {
  quantityBreaks: QuantityBreakRule[];
  hasAnyRules: boolean;
}

/** A priced line. `baseAmountMinor` is the undiscounted line total; `amountMinor` is what is charged. */
export interface PricedLine {
  lineItemId: string;
  skuId: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  baseAmountMinor: number;
  appliedDiscountPct: number;
  leadTimeDays: number | null;
}

/** The fully priced quote: priced lines plus totals in minor units. `blocked` forces review (EC-02). */
export interface PricedQuote {
  lines: PricedLine[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  leadTimeDays: number | null;
  blocked: boolean;
}
