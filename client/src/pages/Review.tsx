import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRequest } from '../api/requests';
import type { RequestStatus } from '../api/interface/request-status';
import { OriginalRequestPane } from '../components/review/OriginalRequestPane';
import { ReviewActionBar } from '../components/review/ReviewActionBar';
import { RoutingReasonsBanner } from '../components/review/RoutingReasonsBanner';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { reasonsSummary } from '../lib/routing-reason';

const ROUTING_BADGE: Record<
  'auto_eligible' | 'needs_review',
  { badge: string; dot: string; label: string }
> = {
  needs_review: { badge: 'bg-md-bg text-md-tx', dot: 'bg-md-dot', label: 'Needs review' },
  auto_eligible: { badge: 'bg-hi-bg text-hi-tx', dot: 'bg-hi-dot', label: 'Auto eligible' },
};

interface ConfidenceRoutingBadgeProps {
  confidence: number | null;
  routing: 'auto_eligible' | 'needs_review' | null;
}

function ConfidenceRoutingBadge({ confidence, routing }: ConfidenceRoutingBadgeProps) {
  if (!routing || confidence === null) return null;
  const pct = Math.round(Math.min(Math.max(confidence, 0), 1) * 100);
  const { badge, dot, label } = ROUTING_BADGE[routing];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      Overall {pct}% · {label}
    </span>
  );
}

function PlaceholderPane({ title }: { title: string }) {
  const headingId = `${title.toLowerCase().replace(/\s+/g, '-')}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-1 flex-col gap-4">
      <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="flex flex-1 items-center justify-center rounded-card border border-dashed border-border py-10 text-sm text-muted">
        Coming soon
      </div>
    </section>
  );
}

export function Review() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError } = useRequest(id);
  const [downloadError, setDownloadError] = useState('');

  const heading = request?.sender_company ?? request?.sender_contact ?? 'Request';

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">Review · {heading}</h1>
          {request && (request.overall_confidence !== null || request.routing) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ConfidenceRoutingBadge
                confidence={request.overall_confidence}
                routing={request.routing}
              />
              {request.routing_reasons.length > 0 && (
                <span className="text-sm text-muted">
                  {reasonsSummary(request.routing_reasons)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {id && (
            <Link
              to={`/requests/${id}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Back to processing
            </Link>
          )}
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            Back to inbox
          </Link>
        </div>
      </div>

      {downloadError && (
        <div className="mb-4">
          <ErrorBanner message={downloadError} />
        </div>
      )}

      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Loading request…
        </div>
      ) : isError || !request ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Could not load this request.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ReviewActionBar requestId={request.id} status={request.status as RequestStatus} />
          <RoutingReasonsBanner
            routing={request.routing}
            routing_reasons={request.routing_reasons}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-border bg-surface p-4">
              <OriginalRequestPane request={request} onError={setDownloadError} />
            </div>
            <div className="flex rounded-card border border-border bg-surface p-4">
              <PlaceholderPane title="Parsed structure" />
            </div>
            <div className="flex rounded-card border border-border bg-surface p-4">
              <PlaceholderPane title="Suggested quote" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
