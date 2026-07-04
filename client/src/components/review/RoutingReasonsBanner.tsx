import type { RoutingReason } from '../../api/requests';
import { Disclosure } from '../ui/Disclosure';

interface RoutingReasonsBannerProps {
  routing: 'auto_eligible' | 'needs_review' | null;
  routing_reasons: RoutingReason[];
}

export function RoutingReasonsBanner({ routing, routing_reasons }: RoutingReasonsBannerProps) {
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
    <Disclosure trigger={<span className="text-sm font-medium text-slate-600">Review flags</span>}>
      <ul role="list" className="flex flex-col gap-1.5">
        {routing_reasons.map((reason) => (
          <li
            key={`${reason.code}-${reason.source}-${reason.message}`}
            className="flex items-start gap-2"
          >
            <span
              className="mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
              aria-hidden="true"
            />
            <span className="text-sm text-body-text">{reason.message}</span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
