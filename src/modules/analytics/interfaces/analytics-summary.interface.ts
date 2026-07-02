/**
 * Read model for `GET /api/v1/analytics/summary` (US-E7-2-BE). Field names mirror the Analytics
 * screen's contract exactly (sibling US-E7-2). Every value is derived from the caller org's real
 * `audit_events` / `requests` / `quotes`, never a placeholder. Percentages are 0-100; a rate with no
 * denominator in the window is 0 rather than a division error (EC-01).
 */
export interface ConfidenceDistribution {
  high_pct: number;
  medium_pct: number;
  low_pct: number;
}

export interface QuoteFunnel {
  ingested: number;
  drafted: number;
  approved: number;
  sent: number;
}

export interface AnalyticsSummary {
  median_time_to_draft_seconds: number;
  median_time_to_draft_delta_pct: number;
  zero_edit_approval_pct: number;
  zero_edit_approval_delta_pts: number;
  auto_eligible_false_negative_pct: number;
  auto_eligible_false_negative_delta_pts: number;
  quotes_this_week: number;
  quotes_this_week_delta: number;
  crash_recoveries_this_month: number;
  confidence_distribution: ConfidenceDistribution;
  quote_funnel: QuoteFunnel;
}
