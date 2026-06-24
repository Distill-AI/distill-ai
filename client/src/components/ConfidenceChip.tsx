import { DEFAULT_THRESHOLDS } from '../config/thresholds';
import type { ConfidenceThresholds } from '../config/thresholds';

interface ConfidenceChipProps {
  value: number | null;
  thresholds?: ConfidenceThresholds;
  skuLabel?: string;
}

function band(value: number, thresholds: ConfidenceThresholds): 'hi' | 'md' | 'lo' {
  if (value >= thresholds.autoThreshold) return 'hi';
  if (value >= thresholds.matchThreshold) return 'md';
  return 'lo';
}

const bands = {
  hi: {
    container: 'bg-hi-bg text-hi-tx',
    dot: 'bg-hi-dot',
    needsReview: false,
  },
  md: {
    container: 'bg-md-bg text-md-tx',
    dot: 'bg-md-dot',
    needsReview: false,
  },
  lo: {
    container: 'bg-lo-bg text-lo-tx',
    dot: 'bg-lo-dot',
    needsReview: true,
  },
} as const;

export function ConfidenceChip({
  value,
  thresholds = DEFAULT_THRESHOLDS,
  skuLabel,
}: ConfidenceChipProps) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">
        <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />
        {skuLabel ?? 'No data'}
      </span>
    );
  }

  const b = band(value, thresholds);
  const { container, dot, needsReview } = bands[b];
  const pct = `${Math.round(value * 100)}%`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${container}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <span>{pct}</span>
      {skuLabel && <span className="font-mono">{skuLabel}</span>}
      {needsReview && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 rounded bg-lo-tx/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lo-tx">
          Review
        </span>
      )}
    </span>
  );
}
