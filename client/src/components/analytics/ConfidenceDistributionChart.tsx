interface ConfidenceDistributionChartProps {
  /** Each 0-100. Caller is responsible for the three summing to ~100; the chart doesn't enforce it. */
  highPct: number;
  mediumPct: number;
  lowPct: number;
}

const TRACK_HEIGHT_PX = 200;

const bars: { key: 'high' | 'medium' | 'low'; label: string; barClass: string }[] = [
  { key: 'high', label: 'High', barClass: 'bg-hi-dot' },
  { key: 'medium', label: 'Medium', barClass: 'bg-md-dot' },
  { key: 'low', label: 'Low', barClass: 'bg-lo-dot' },
];

function clampPct(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
}

export function ConfidenceDistributionChart({
  highPct,
  mediumPct,
  lowPct,
}: ConfidenceDistributionChartProps) {
  const values: Record<'high' | 'medium' | 'low', number> = {
    high: clampPct(highPct),
    medium: clampPct(mediumPct),
    low: clampPct(lowPct),
  };

  if (values.high === 0 && values.medium === 0 && values.low === 0) {
    return <p className="text-sm text-muted">No data</p>;
  }

  return (
    <div>
      <div className="flex items-end justify-center gap-8" style={{ height: TRACK_HEIGHT_PX }}>
        {bars.map(({ key, barClass }) => (
          <div key={key} className="flex h-full w-12 flex-col items-center justify-end gap-2">
            <span className="font-mono text-xs text-body-text">{values[key]}%</span>
            <div className={`w-full rounded-t ${barClass}`} style={{ height: `${values[key]}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-8">
        {bars.map(({ key, label }) => (
          <span key={key} className="w-12 text-center text-sm text-slate-900">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
