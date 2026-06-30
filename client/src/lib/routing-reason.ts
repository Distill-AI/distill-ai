import type { RoutingReason } from '../api/interface/routing-reason';

const REASON_SHORT_LABEL: Record<string, string> = {
  low_line_confidence: 'line below match threshold',
  deal_value_exceeds_cap: 'deal value over auto-send cap',
  deal_value_cap: 'deal value over auto-send cap',
  policy_flags_detected: 'policy flags',
  incomplete_deal_value: 'incomplete pricing',
  no_line_items: 'no line items',
  policy_breach: 'policy breach',
  extraction_failed: 'extraction failed',
  extraction_empty_source: 'empty source',
};

export function reasonsSummary(reasons: RoutingReason[]): string {
  return reasons.map((r) => REASON_SHORT_LABEL[r.code] ?? r.code).join(' · ');
}
