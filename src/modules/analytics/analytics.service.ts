import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  AnalyticsSummary,
  ConfidenceDistribution,
  QuoteFunnel,
} from './interfaces/analytics-summary.interface';

/** Reporting window. `prior` is the equal-length window immediately before `from`, used for deltas. */
export interface AnalyticsWindow {
  from: Date;
  to: Date;
}

/** Raw scalars pulled from SQL before any percentage/delta math (kept separate so the derivation is
 * pure and unit-testable without a database). Numbers arrive from node-pg as strings for aggregates. */
export interface AnalyticsRawStats {
  funnel: { ingested: number; drafted: number; approved: number; sent: number };
  medianCurSec: number | null;
  medianPriorSec: number | null;
  quotesCur: number;
  quotesPrior: number;
  approvedCurTotal: number;
  approvedCurZeroEdit: number;
  approvedPriorTotal: number;
  approvedPriorZeroEdit: number;
  needsReviewCurTotal: number;
  needsReviewCurFalseNeg: number;
  needsReviewPriorTotal: number;
  needsReviewPriorFalseNeg: number;
  confidence: { high: number; medium: number; low: number; total: number };
  crashRecoveries: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Percentage of `num` over `den`, 0 when there is nothing to divide by (EC-01: no division error). */
const pct = (num: number, den: number): number => (den > 0 ? round1((num / den) * 100) : 0);

/** Relative change of `cur` vs `prior` as a percentage; 0 when there is no comparable prior value. */
const pctChange = (cur: number | null, prior: number | null): number =>
  cur != null && prior != null && prior !== 0 ? round1(((cur - prior) / prior) * 100) : 0;

/**
 * Pure derivation of the summary from raw counts: percentages, period-over-period deltas, and the
 * confidence tiers. Exported so the arithmetic (small-sample guards, monotonic funnel pass-through,
 * delta math) is tested directly, independent of the SQL.
 */
export function assembleSummary(raw: AnalyticsRawStats): AnalyticsSummary {
  const zeroEditCur = pct(raw.approvedCurZeroEdit, raw.approvedCurTotal);
  const zeroEditPrior = pct(raw.approvedPriorZeroEdit, raw.approvedPriorTotal);
  const falseNegCur = pct(raw.needsReviewCurFalseNeg, raw.needsReviewCurTotal);
  const falseNegPrior = pct(raw.needsReviewPriorFalseNeg, raw.needsReviewPriorTotal);

  const confidence: ConfidenceDistribution = {
    high_pct: pct(raw.confidence.high, raw.confidence.total),
    medium_pct: pct(raw.confidence.medium, raw.confidence.total),
    low_pct: pct(raw.confidence.low, raw.confidence.total),
  };
  const quote_funnel: QuoteFunnel = { ...raw.funnel };

  return {
    median_time_to_draft_seconds: Math.round(raw.medianCurSec ?? 0),
    median_time_to_draft_delta_pct: pctChange(raw.medianCurSec, raw.medianPriorSec),
    zero_edit_approval_pct: zeroEditCur,
    zero_edit_approval_delta_pts: round1(zeroEditCur - zeroEditPrior),
    auto_eligible_false_negative_pct: falseNegCur,
    auto_eligible_false_negative_delta_pts: round1(falseNegCur - falseNegPrior),
    quotes_this_week: raw.quotesCur,
    quotes_this_week_delta: raw.quotesCur - raw.quotesPrior,
    crash_recoveries_this_month: raw.crashRecoveries,
    confidence_distribution: confidence,
    quote_funnel,
  };
}

// High/medium/low confidence tiers match the client thresholds (autoThreshold 0.95, matchThreshold 0.7).
const HIGH_THRESHOLD = 0.95;
const MEDIUM_THRESHOLD = 0.7;

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Computes every KPI for `orgId` over `window`, scoped to that org's rows only (SEC-01). */
  async getSummary(orgId: string, window: AnalyticsWindow): Promise<AnalyticsSummary> {
    const { from, to } = window;
    const priorFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const monthAgo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [funnel, median, quotes, approved, needsReview, confidence, crash] = await Promise.all([
      this.query(FUNNEL_SQL, [orgId, from, to]),
      this.query(MEDIAN_SQL, [orgId, from, to, priorFrom]),
      this.query(QUOTES_SQL, [orgId, from, to, priorFrom]),
      this.query(APPROVED_SQL, [orgId, from, to, priorFrom]),
      this.query(NEEDS_REVIEW_SQL, [orgId, from, to, priorFrom]),
      this.query(CONFIDENCE_SQL, [orgId, from, to, HIGH_THRESHOLD, MEDIUM_THRESHOLD]),
      this.query(CRASH_SQL, [orgId, monthAgo, to]),
    ]);

    return assembleSummary({
      funnel: {
        ingested: num(funnel.ingested),
        drafted: num(funnel.drafted),
        approved: num(funnel.approved),
        sent: num(funnel.sent),
      },
      medianCurSec: nullableNum(median.cur),
      medianPriorSec: nullableNum(median.prior),
      quotesCur: num(quotes.cur),
      quotesPrior: num(quotes.prior),
      approvedCurTotal: num(approved.cur_total),
      approvedCurZeroEdit: num(approved.cur_zero),
      approvedPriorTotal: num(approved.prior_total),
      approvedPriorZeroEdit: num(approved.prior_zero),
      needsReviewCurTotal: num(needsReview.cur_total),
      needsReviewCurFalseNeg: num(needsReview.cur_fn),
      needsReviewPriorTotal: num(needsReview.prior_total),
      needsReviewPriorFalseNeg: num(needsReview.prior_fn),
      confidence: {
        high: num(confidence.high),
        medium: num(confidence.medium),
        low: num(confidence.low),
        total: num(confidence.total),
      },
      crashRecoveries: num(crash.n),
    });
  }

  private async query(sql: string, params: unknown[]): Promise<Record<string, unknown>> {
    const rows = (await this.dataSource.query(sql, params)) as Record<string, unknown>[];
    return rows[0] ?? {};
  }
}

const num = (value: unknown): number => Number(value ?? 0) || 0;
const nullableNum = (value: unknown): number | null => (value == null ? null : Number(value));

// Snapshot funnel from the current status of requests created in the window. Each stage is a strict
// subset of the previous (a quote is required to be approved, approval to be sent), so the counts are
// monotonically non-increasing by construction (AC-02) and read in one consistent snapshot (EC-02).
const FUNNEL_SQL = `
  SELECT
    count(*) AS ingested,
    count(q.id) AS drafted,
    count(*) FILTER (WHERE q.status IN ('approved','ready','sent')) AS approved,
    count(*) FILTER (WHERE q.status = 'sent') AS sent
  FROM requests r
  LEFT JOIN quotes q ON q.request_id = r.id AND q.org_id = r.org_id
  WHERE r.org_id = $1 AND r.created_at >= $2 AND r.created_at < $3`;

// Median seconds from request intake to its quote being drafted, for the current and prior windows.
const MEDIAN_SQL = `
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) FILTER (WHERE d >= $2 AND d < $3) AS cur,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) FILTER (WHERE d >= $4 AND d < $2) AS prior
  FROM (
    SELECT EXTRACT(EPOCH FROM (q.created_at - r.created_at)) AS sec, q.created_at AS d
    FROM requests r
    JOIN quotes q ON q.request_id = r.id AND q.org_id = r.org_id
    WHERE r.org_id = $1 AND q.created_at >= $4 AND q.created_at < $3
  ) t`;

const QUOTES_SQL = `
  SELECT
    count(*) FILTER (WHERE created_at >= $2 AND created_at < $3) AS cur,
    count(*) FILTER (WHERE created_at >= $4 AND created_at < $2) AS prior
  FROM quotes
  WHERE org_id = $1 AND created_at >= $4 AND created_at < $3`;

// Approved quotes and how many had no manually-overridden line (zero-edit), current vs prior window.
const APPROVED_SQL = `
  WITH approved_reqs AS (
    SELECT r.id, q.created_at AS qc,
      coalesce(bool_or(li.flags ? 'manual_override'), false) AS has_override
    FROM requests r
    JOIN quotes q ON q.request_id = r.id AND q.org_id = r.org_id
      AND q.status IN ('approved','ready','sent')
    LEFT JOIN line_items li ON li.request_id = r.id
    WHERE r.org_id = $1 AND q.created_at >= $4 AND q.created_at < $3
    GROUP BY r.id, q.created_at
  )
  SELECT
    count(*) FILTER (WHERE qc >= $2 AND qc < $3) AS cur_total,
    count(*) FILTER (WHERE qc >= $2 AND qc < $3 AND NOT has_override) AS cur_zero,
    count(*) FILTER (WHERE qc >= $4 AND qc < $2) AS prior_total,
    count(*) FILTER (WHERE qc >= $4 AND qc < $2 AND NOT has_override) AS prior_zero
  FROM approved_reqs`;

// Requests the router sent to needs_review that were then approved with no edits (a false negative
// of auto-routing), current vs prior window.
const NEEDS_REVIEW_SQL = `
  WITH nr AS (
    SELECT r.id, r.created_at AS rc,
      bool_or(q.status IN ('approved','ready','sent')) AS approved,
      coalesce(bool_or(li.flags ? 'manual_override'), false) AS has_override
    FROM requests r
    LEFT JOIN quotes q ON q.request_id = r.id AND q.org_id = r.org_id
    LEFT JOIN line_items li ON li.request_id = r.id
    WHERE r.org_id = $1 AND r.routing = 'needs_review' AND r.created_at >= $4 AND r.created_at < $3
    GROUP BY r.id, r.created_at
  )
  SELECT
    count(*) FILTER (WHERE rc >= $2 AND rc < $3) AS cur_total,
    count(*) FILTER (WHERE rc >= $2 AND rc < $3 AND approved AND NOT has_override) AS cur_fn,
    count(*) FILTER (WHERE rc >= $4 AND rc < $2) AS prior_total,
    count(*) FILTER (WHERE rc >= $4 AND rc < $2 AND approved AND NOT has_override) AS prior_fn
  FROM nr`;

const CONFIDENCE_SQL = `
  SELECT
    count(*) FILTER (WHERE overall_confidence >= $4) AS high,
    count(*) FILTER (WHERE overall_confidence >= $5 AND overall_confidence < $4) AS medium,
    count(*) FILTER (WHERE overall_confidence < $5) AS low,
    count(*) AS total
  FROM requests
  WHERE org_id = $1 AND created_at >= $2 AND created_at < $3 AND overall_confidence IS NOT NULL`;

const CRASH_SQL = `
  SELECT count(*) AS n
  FROM audit_events
  WHERE org_id = $1 AND event_name = 'request.resumed'
    AND attributes->>'reason' = 'crash_recovery'
    AND created_at >= $2 AND created_at < $3`;
