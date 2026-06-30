/** The re-mapped line as confirmed by the server after recompute (US-E6-2-BE AC-02). */
export interface RemappedLine {
  id: string;
  matched_sku_id: string | null;
  quantity: number | null;
  unit_price_minor: number | null;
  match_confidence: number | null;
}

/** Server-confirmed quote totals after a re-map recompute. `blocked` is the EC-04 no-rule case. */
export interface RemapQuoteTotals {
  quote_id: string | null;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  lead_time_days: number | null;
  blocked: boolean;
}

/** Response payload for PATCH /requests/:id/line-items/:lineId. */
export interface RemapResponsePayload {
  request_id: string;
  line: RemappedLine;
  quote: RemapQuoteTotals;
}
