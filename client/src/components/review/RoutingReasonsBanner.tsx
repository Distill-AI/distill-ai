import { useState, useId } from 'react';
import type { RoutingReason } from '../../api/requests';

interface RoutingReasonsBannerProps {
  routing: 'auto_eligible' | 'needs_review' | null;
  routing_reasons: RoutingReason[];
}

export function RoutingReasonsBanner({ routing, routing_reasons }: RoutingReasonsBannerProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  if (routing === 'auto_eligible') {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-hi-dot" aria-hidden="true" />
          <p className="text-sm text-body-text">All clear - auto-eligible to send</p>
        </div>
      </div>
    );
  }

  if (routing === null && routing_reasons.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5"
      >
        <span className="text-sm font-medium text-slate-600">Review flags</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`h-3 w-3 text-muted transition-transform ${open ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
        </svg>
        <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
          AI explanation
        </span>
      </button>

      <div
        id={bodyId}
        hidden={!open}
        className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-canvas p-3.5"
      >
        <ul role="list" className="flex flex-col gap-1.5">
          {routing_reasons.map((reason) => (
            <li key={`${reason.code}-${reason.source}-${reason.message}`} className="flex items-start gap-2">
              <span
                className="mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                aria-hidden="true"
              />
              <span className="text-sm text-body-text">{reason.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
