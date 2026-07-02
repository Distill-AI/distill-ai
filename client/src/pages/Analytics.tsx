import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAnalyticsSummary } from '../api/analytics';
import type { AnalyticsSummary } from '../api/analytics';
import { usePageHeader } from '../context/PageHeaderContext';
import { KpiCard } from '../components/ui/KpiCard';
import { ConfidenceDistributionChart } from '../components/analytics/ConfidenceDistributionChart';
import { QuoteFunnelChart } from '../components/analytics/QuoteFunnelChart';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { formatDuration } from '../lib/formatDuration';

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-card bg-canvas" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-card bg-canvas" />
        <div className="h-64 animate-pulse rounded-card bg-canvas" />
      </div>
    </div>
  );
}

function formatDelta(value: number, suffix: string): string {
  return `${value >= 0 ? '+' : ''}${value}${suffix}`;
}

type Sentiment = 'positive' | 'negative';

/** Metrics where a falling value is the good outcome (e.g. fewer false negatives, a faster draft). */
function lowerIsBetter(value: number): Sentiment {
  return value <= 0 ? 'positive' : 'negative';
}

/** Metrics where a rising value is the good outcome (e.g. more approvals, more quotes). */
function higherIsBetter(value: number): Sentiment {
  return value >= 0 ? 'positive' : 'negative';
}

/** Numeric field guard: the response is trusted to the TS interface at compile time only, so a
 * malformed or partial payload (e.g. a missing nested object) falls back to 0 instead of throwing
 * a render-time TypeError that the error banner would never catch. */
function num(value: number | undefined | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export interface AnalyticsViewProps {
  data: AnalyticsSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** Pure render of the Analytics screen's loading/error/empty/populated states, driven entirely by props. */
export function AnalyticsView({ data, isLoading, isError, onRetry }: AnalyticsViewProps) {
  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !data) {
    return (
      <div className="px-6 py-6">
        <ErrorBanner message="Could not load analytics." onRetry={onRetry} />
      </div>
    );
  }

  // Funnel's first stage is the true "nothing happened this period" signal — quotes_this_week or an
  // individual chart being zero doesn't mean the whole period was empty (e.g. a lull this week with a
  // non-zero crash-recovery count from earlier in the period should still show its card).
  const isEmpty = num(data.quote_funnel?.ingested) === 0;

  if (isEmpty) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted">No quotes processed in this period yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Median time to draft"
          value={formatDuration(num(data.median_time_to_draft_seconds))}
          delta={formatDelta(num(data.median_time_to_draft_delta_pct), '%')}
          sentiment={lowerIsBetter(num(data.median_time_to_draft_delta_pct))}
        />
        <KpiCard
          label="Zero-edit approval"
          value={`${num(data.zero_edit_approval_pct)}%`}
          delta={formatDelta(num(data.zero_edit_approval_delta_pts), 'pts')}
          sentiment={higherIsBetter(num(data.zero_edit_approval_delta_pts))}
        />
        <KpiCard
          label="Auto-eligible false-neg"
          value={`${num(data.auto_eligible_false_negative_pct)}%`}
          delta={formatDelta(num(data.auto_eligible_false_negative_delta_pts), 'pts')}
          sentiment={lowerIsBetter(num(data.auto_eligible_false_negative_delta_pts))}
        />
        <KpiCard
          label="Quotes this week"
          value={String(num(data.quotes_this_week))}
          delta={formatDelta(num(data.quotes_this_week_delta), '')}
          sentiment={higherIsBetter(num(data.quotes_this_week_delta))}
        />
        <KpiCard label="Crash recoveries" value={String(num(data.crash_recoveries_this_month))} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Confidence distribution">
          <ConfidenceDistributionChart
            highPct={num(data.confidence_distribution?.high_pct)}
            mediumPct={num(data.confidence_distribution?.medium_pct)}
            lowPct={num(data.confidence_distribution?.low_pct)}
          />
        </ChartCard>
        <ChartCard title="Quote funnel">
          <QuoteFunnelChart
            stages={[
              { label: 'Ingested', value: num(data.quote_funnel?.ingested) },
              { label: 'Drafted', value: num(data.quote_funnel?.drafted) },
              { label: 'Approved', value: num(data.quote_funnel?.approved) },
              { label: 'Sent', value: num(data.quote_funnel?.sent) },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

export function Analytics() {
  const { setTitle, setActions } = usePageHeader();
  const { data, isLoading, isError, refetch } = useAnalyticsSummary();

  useEffect(() => {
    setTitle('Analytics');
    setActions(
      <button
        type="button"
        disabled
        className="flex h-9 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Last 30 days
      </button>,
    );
    return () => {
      setTitle(null);
      setActions(null);
    };
  }, [setTitle, setActions]);

  return (
    <AnalyticsView
      data={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => void refetch()}
    />
  );
}
