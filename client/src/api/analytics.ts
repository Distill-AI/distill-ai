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
