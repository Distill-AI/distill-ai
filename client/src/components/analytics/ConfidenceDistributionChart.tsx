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

export function ConfidenceDistributionChart({
  highPct,
  mediumPct,
  lowPct,
}: ConfidenceDistributionChartProps) {
  const values: Record<'high' | 'medium' | 'low', number> = {
    high: highPct,
    medium: mediumPct,
    low: lowPct,
  };

  if (highPct === 0 && mediumPct === 0 && lowPct === 0) {
    return <p className="text-sm text-muted">No data</p>;
  }

  const maxPct = Math.max(highPct, mediumPct, lowPct, 1);

  return (
    <div>
      <div className="flex items-end justify-center gap-8" style={{ height: TRACK_HEIGHT_PX }}>
        {bars.map(({ key, barClass }) => (
          <div key={key} className="flex h-full w-12 flex-col items-center justify-end gap-2">
            <span className="font-mono text-xs text-body-text">{values[key]}%</span>
            <div
              className={`w-full rounded-t ${barClass}`}
              style={{ height: `${(values[key] / maxPct) * 100}%` }}
            />
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
