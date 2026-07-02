import type { DataSource } from 'typeorm';
import { AnalyticsService, assembleSummary, type AnalyticsRawStats } from '../analytics.service';

function rawStats(overrides: Partial<AnalyticsRawStats> = {}): AnalyticsRawStats {
  return {
    funnel: { ingested: 120, drafted: 96, approved: 71, sent: 58 },
    medianCurSec: 7010,
    medianPriorSec: 8000,
    quotesCur: 42,
    quotesPrior: 36,
    approvedCurTotal: 3,
    approvedCurZeroEdit: 2,
    approvedPriorTotal: 4,
    approvedPriorZeroEdit: 2,
    needsReviewCurTotal: 12,
    needsReviewCurFalseNeg: 1,
    needsReviewPriorTotal: 10,
    needsReviewPriorFalseNeg: 2,
    confidence: { high: 64, medium: 27, low: 9, total: 100 },
    crashRecoveries: 3,
    ...overrides,
  };
}

describe('assembleSummary', () => {
  it('derives percentages, deltas, and tiers from raw counts', () => {
    const s = assembleSummary(rawStats());

    expect(s.median_time_to_draft_seconds).toBe(7010);
    // (7010 - 8000) / 8000 * 100 = -12.4 (round1)
    expect(s.median_time_to_draft_delta_pct).toBe(-12.4);
    expect(s.zero_edit_approval_pct).toBe(66.7); // 2/3
    expect(s.zero_edit_approval_delta_pts).toBe(16.7); // 66.7 - 50.0
    expect(s.auto_eligible_false_negative_pct).toBe(8.3); // 1/12
    expect(s.auto_eligible_false_negative_delta_pts).toBe(-11.7); // 8.3 - 20.0
    expect(s.quotes_this_week).toBe(42);
    expect(s.quotes_this_week_delta).toBe(6); // 42 - 36
    expect(s.crash_recoveries_this_month).toBe(3);
    expect(s.confidence_distribution).toEqual({ high_pct: 64, medium_pct: 27, low_pct: 9 });
    expect(s.quote_funnel).toEqual({ ingested: 120, drafted: 96, approved: 71, sent: 58 });
  });

  it('returns zeros instead of dividing by zero on an empty window (EC-01)', () => {
    const s = assembleSummary(
      rawStats({
        funnel: { ingested: 0, drafted: 0, approved: 0, sent: 0 },
        medianCurSec: null,
        medianPriorSec: null,
        quotesCur: 0,
        quotesPrior: 0,
        approvedCurTotal: 0,
        approvedCurZeroEdit: 0,
        approvedPriorTotal: 0,
        approvedPriorZeroEdit: 0,
        needsReviewCurTotal: 0,
        needsReviewCurFalseNeg: 0,
        needsReviewPriorTotal: 0,
        needsReviewPriorFalseNeg: 0,
        confidence: { high: 0, medium: 0, low: 0, total: 0 },
        crashRecoveries: 0,
      }),
    );

    for (const value of [
      s.median_time_to_draft_seconds,
      s.median_time_to_draft_delta_pct,
      s.zero_edit_approval_pct,
      s.zero_edit_approval_delta_pts,
      s.auto_eligible_false_negative_pct,
      s.auto_eligible_false_negative_delta_pts,
      s.quotes_this_week,
      s.quotes_this_week_delta,
      s.confidence_distribution.high_pct,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBe(0);
    }
  });

  it('treats a missing prior value as a zero delta, not NaN', () => {
    const s = assembleSummary(rawStats({ medianPriorSec: null, quotesPrior: 0 }));
    expect(s.median_time_to_draft_delta_pct).toBe(0);
    expect(s.quotes_this_week_delta).toBe(42);
  });
});

describe('AnalyticsService.getSummary', () => {
  it('scopes every query to the org and assembles coerced string counts', async () => {
    const query = vi
      .fn()
      // Order matches Promise.all: funnel, median, quotes, approved, needsReview, confidence, crash.
      .mockResolvedValueOnce([{ ingested: '10', drafted: '8', approved: '5', sent: '3' }])
      .mockResolvedValueOnce([{ cur: '7010.5', prior: null }])
      .mockResolvedValueOnce([{ cur: '4', prior: '2' }])
      .mockResolvedValueOnce([{ cur_total: '3', cur_zero: '3', prior_total: '0', prior_zero: '0' }])
      .mockResolvedValueOnce([{ cur_total: '2', cur_fn: '1', prior_total: '0', prior_fn: '0' }])
      .mockResolvedValueOnce([{ high: '6', medium: '3', low: '1', total: '10' }])
      .mockResolvedValueOnce([{ n: '2' }]);
    const service = new AnalyticsService({ query } as unknown as DataSource);

    const from = new Date('2026-06-25T00:00:00Z');
    const to = new Date('2026-07-02T00:00:00Z');
    const result = await service.getSummary('org-1', { from, to });

    // Every query filters by the org id passed as $1.
    for (const call of query.mock.calls) {
      expect(call[1][0]).toBe('org-1');
    }
    expect(result.quote_funnel).toEqual({ ingested: 10, drafted: 8, approved: 5, sent: 3 });
    expect(result.median_time_to_draft_seconds).toBe(7011); // rounded from "7010.5"
    expect(result.zero_edit_approval_pct).toBe(100); // 3/3
    expect(result.confidence_distribution).toEqual({ high_pct: 60, medium_pct: 30, low_pct: 10 });
    expect(result.crash_recoveries_this_month).toBe(2);
  });
});
