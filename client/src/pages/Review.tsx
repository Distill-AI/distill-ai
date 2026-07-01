import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRequest } from '../api/requests';
import type { RequestStatus } from '../api/interface/request-status';
import { OriginalRequestPane } from '../components/review/OriginalRequestPane';
import { ParsedStructurePane } from '../components/review/ParsedStructurePane';
import { SuggestedQuotePane } from '../components/review/SuggestedQuotePane';
import { DeclineModal } from '../components/review/DeclineModal';
import { RoutingReasonsBanner } from '../components/review/RoutingReasonsBanner';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { usePageHeader } from '../context/PageHeaderContext';
import { QuestionMarkCircleIcon } from '../components/ui/QuestionMarkCircleIcon';
import { ChevronLeftIcon } from '../components/ui/ChevronLeftIcon';
import { reasonsSummary } from '../lib/routing-reason';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  catalog_rfq: 'Catalog RFQ',
  direct_order: 'Direct Order',
  spot_quote: 'Spot Quote',
};

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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const [declineOpen, setDeclineOpen] = useState(false);
  const declineBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { setTitle, setActions } = usePageHeader();

  // Clear a stale download error when navigating to a different request (adjust-state-on-prop-change,
  // not an effect, so there is no extra render pass).
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setDownloadError('');
  }

  useEffect(() => {
    const heading = request?.sender_company ?? request?.sender_contact ?? 'Request';
    setTitle(
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className="flex h-8 w-8 flex-none items-center justify-center rounded text-body-text hover:bg-canvas"
          aria-label="Back to inbox"
        >
          <ChevronLeftIcon />
        </Link>
        <h1 className="truncate text-lg font-semibold text-slate-900">Review · {heading}</h1>
      </div>,
    );
    return () => setTitle(null);
  }, [request, setTitle]);

  useEffect(() => {
    if (!request) {
      setActions(null);
      return () => setActions(null);
    }

    if (request.status === 'declined') {
      setActions(
        <span className="text-sm font-medium text-rose-600">This request has been declined.</span>,
      );
      return () => setActions(null);
    }

    setActions(
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/requests/${id}/clarification`)}
          className="flex h-9 items-center gap-2 px-3 text-sm text-body-text hover:text-accent"
        >
          <QuestionMarkCircleIcon />
          Clarification
        </button>
        <button
          ref={declineBtnRef}
          type="button"
          onClick={() => setDeclineOpen(true)}
          disabled={(request.status as RequestStatus) !== 'needs_review'}
          aria-haspopup="dialog"
          className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled
          className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckIcon />
          Approve &amp; generate
        </button>
      </div>,
    );
    return () => setActions(null);
  }, [id, request, setActions, navigate]);

  return (
    <div className="flex h-full flex-col px-6 py-6">
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-slate-900">
              {request.sender_company ?? request.sender_contact ?? 'Unknown sender'}
            </span>
            {request.sender_company && request.sender_contact && (
              <>
                <span aria-hidden="true" className="text-border">
                  |
                </span>
                <span className="text-sm text-muted">{request.sender_contact}</span>
              </>
            )}
            <span className="rounded bg-canvas px-2 py-0.5 text-xs font-medium text-body-text">
              {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
            </span>
            <ConfidenceRoutingBadge
              confidence={request.overall_confidence}
              routing={request.routing}
            />
            {request.routing_reasons.length > 0 && (
              <span className="text-sm text-muted">{reasonsSummary(request.routing_reasons)}</span>
            )}
          </div>

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

      {request && (
        <DeclineModal
          requestId={request.id}
          open={declineOpen}
          onClose={() => setDeclineOpen(false)}
          triggerRef={declineBtnRef}
        />
      )}
    </div>
  );
}
