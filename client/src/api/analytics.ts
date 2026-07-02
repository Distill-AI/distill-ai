import { useQuery } from '@tanstack/react-query';
import client from './client';

export const analyticsKeys = {
  summary: () => ['analytics', 'summary'] as const,
};

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
  confidence_distribution: { high_pct: number; medium_pct: number; low_pct: number };
  quote_funnel: { ingested: number; drafted: number; approved: number; sent: number };
}

// GET /analytics/summary has no server-side implementation yet (frontend + mock data only, per
// plan-m4-storybook.md's scope). Until a backend track ships this endpoint with this exact field
// shape, the Analytics page will only ever render its error state in a running app — expected, not
// a bug. AnalyticsView.tsx additionally guards individual fields against a malformed/partial
// response so a shape mismatch degrades to zeroed cards rather than a render-time crash.
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await client.get<{ data: AnalyticsSummary }>('/analytics/summary');
  return res.data.data;
}

/** Loads the Analytics screen's KPI and chart data. */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsKeys.summary(),
    queryFn: fetchAnalyticsSummary,
  });
}
