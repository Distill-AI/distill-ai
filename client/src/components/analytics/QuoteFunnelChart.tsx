interface QuoteFunnelStage {
  label: string;
  value: number;
}

interface QuoteFunnelChartProps {
  /** Stages in funnel order, e.g. Ingested -> Drafted -> Approved -> Sent. First stage is treated as 100%. */
  stages: QuoteFunnelStage[];
}

function widthPct(value: number, total: number): number {
  const raw = Number.isFinite(value) ? (value / total) * 100 : 0;
  return Math.min(100, Math.max(0, raw));
}

export function QuoteFunnelChart({ stages }: QuoteFunnelChartProps) {
  const total = stages[0]?.value ?? 0;

  if (stages.length === 0 || !Number.isFinite(total) || total <= 0) {
    return <p className="text-sm text-muted">No quotes processed in this period</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage) => (
        <div key={stage.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-sm text-body-text">{stage.label}</span>
          <div className="h-6 flex-1 rounded bg-canvas">
            <div
              className="h-full rounded bg-indigo-600"
              style={{ width: `${widthPct(stage.value, total)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-900">
            {stage.value}
          </span>
        </div>
      ))}
    </div>
  );
}
