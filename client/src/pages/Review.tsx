import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRequest } from '../api/requests';
import type { RequestStatus } from '../api/interface/request-status';
import { OriginalRequestPane } from '../components/review/OriginalRequestPane';
import { ParsedStructurePane } from '../components/review/ParsedStructurePane';
import { SuggestedQuotePane } from '../components/review/SuggestedQuotePane';
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

/** One independently-scrolling pane of the 3-pane workspace (EC-03). */
function Pane({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 overflow-y-auto rounded-card border border-border bg-surface p-4">
      {children}
    </div>
  );
}

export function Review() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError, refetch } = useRequest(id);
  const [downloadError, setDownloadError] = useState('');

  // Clear a stale download error when navigating to a different request (adjust-state-on-prop-change,
  // not an effect, so there is no extra render pass).
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setDownloadError('');
  }

  const heading = request?.sender_company ?? request?.sender_contact ?? 'Request';

  return (
    <div className="flex h-full flex-col px-6 py-6">
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

      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Loading request…
        </div>
      ) : isError || !request ? (
        // EC-02: a failed fetch shows the error variant with a retry, never a blank workspace.
        <ErrorBanner message="Could not load this request." onRetry={() => void refetch()} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {downloadError && <ErrorBanner message={downloadError} />}

          {/* Must stay outside the scrolling grid below so it never scrolls away (FR-1). */}
          <ReviewActionBar requestId={request.id} status={request.status as RequestStatus} />
          <RoutingReasonsBanner
            routing={request.routing}
            routing_reasons={request.routing_reasons}
          />
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <Pane>
              <OriginalRequestPane request={request} onError={setDownloadError} />
            </Pane>
            <Pane>
              <ParsedStructurePane requestId={request.id} lines={request.line_items} />
            </Pane>
            <Pane>
              <SuggestedQuotePane quote={request.quote} />
            </Pane>
          </div>
        </div>
      )}
    </div>
  );
}
