import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
}

/** Small pill for auxiliary metadata labels (e.g. "AI explanation"). For domain-value badges
 * (confidence tiers, request status), use ConfidenceBadge/RequestStatusBadge instead. */
export function Badge({ children }: BadgeProps) {
  return (
    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
      {children}
    </span>
  );
}
