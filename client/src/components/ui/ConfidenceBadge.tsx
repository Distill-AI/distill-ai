import { classifyTier, type ConfidenceTier } from '../../config/thresholds';

const tierClasses: Record<ConfidenceTier, { badge: string; dot: string }> = {
  hi: { badge: 'bg-hi-bg text-hi-tx', dot: 'bg-hi-dot' },
  md: { badge: 'bg-md-bg text-md-tx', dot: 'bg-md-dot' },
  lo: { badge: 'bg-lo-bg text-lo-tx', dot: 'bg-lo-dot' },
};

interface ConfidenceBadgeProps {
  value: number | null;
}

/**
 * Confidence chip for the Inbox CONFIDENCE column. Renders a dash when the
 * request has no overall_confidence yet (e.g. while parsing or on failure).
 */
export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted">-</span>;
  }

  // overall_confidence is a 0-1 fraction; clamp so an out-of-range value from an
  // unexpected response can never render a misleading percentage.
  const clamped = Math.min(Math.max(value, 0), 1);
  const pct = Math.round(clamped * 100);
  const { badge, dot } = tierClasses[classifyTier(clamped)];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {pct}%
    </span>
  );
}
