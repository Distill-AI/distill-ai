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

  const isEmpty =
    data.quotes_this_week === 0 &&
    data.confidence_distribution.high_pct === 0 &&
    data.confidence_distribution.medium_pct === 0 &&
    data.confidence_distribution.low_pct === 0;

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
          value={formatDuration(data.median_time_to_draft_seconds)}
          delta={formatDelta(data.median_time_to_draft_delta_pct, '%')}
        />
        <KpiCard
          label="Zero-edit approval"
          value={`${data.zero_edit_approval_pct}%`}
          delta={formatDelta(data.zero_edit_approval_delta_pts, 'pts')}
        />
        <KpiCard
          label="Auto-eligible false-neg"
          value={`${data.auto_eligible_false_negative_pct}%`}
          delta={formatDelta(data.auto_eligible_false_negative_delta_pts, 'pts')}
        />
        <KpiCard
          label="Quotes this week"
          value={String(data.quotes_this_week)}
          delta={formatDelta(data.quotes_this_week_delta, '')}
        />
        <KpiCard label="Crash recoveries" value={String(data.crash_recoveries_this_month)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Confidence distribution">
          <ConfidenceDistributionChart
            highPct={data.confidence_distribution.high_pct}
            mediumPct={data.confidence_distribution.medium_pct}
            lowPct={data.confidence_distribution.low_pct}
          />
        </ChartCard>
        <ChartCard title="Quote funnel">
          <QuoteFunnelChart
            stages={[
              { label: 'Ingested', value: data.quote_funnel.ingested },
              { label: 'Drafted', value: data.quote_funnel.drafted },
              { label: 'Approved', value: data.quote_funnel.approved },
              { label: 'Sent', value: data.quote_funnel.sent },
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
