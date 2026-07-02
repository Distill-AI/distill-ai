import { TrendingUp } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  /** Signed delta text, e.g. "+41%" or "+6pts". Omit when there's nothing to compare against. */
  delta?: string;
}

export function KpiCard({ label, value, delta }: KpiCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {delta && (
          <span className="flex items-center gap-1 text-sm text-hi-tx">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
