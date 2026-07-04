import { TrendingDown, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  /** Signed delta text, e.g. "+41%" or "-6pts". Omit when there's nothing to compare against. */
  delta?: string;
  /**
   * Whether `delta` is good or bad news for this specific metric. Direction alone doesn't convey
   * sentiment (e.g. a falling false-negative rate is a positive result), so the caller decides.
   * Only used when `delta` is provided.
   */
  sentiment?: 'positive' | 'negative';
}

const sentimentClass: Record<'positive' | 'negative', string> = {
  positive: 'text-success-text',
  negative: 'text-red-600',
};

export function KpiCard({ label, value, delta, sentiment }: KpiCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {delta && (
          <span
            className={`flex items-center gap-1 text-sm ${sentiment ? sentimentClass[sentiment] : 'text-body-text'}`}
          >
            {delta.startsWith('-') ? (
              <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
