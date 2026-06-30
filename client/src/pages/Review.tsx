import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRequest } from '../api/requests';
import type { RequestStatus } from '../api/interface/request-status';
import { OriginalRequestPane } from '../components/review/OriginalRequestPane';
import { ParsedStructurePane } from '../components/review/ParsedStructurePane';
import { SuggestedQuotePane } from '../components/review/SuggestedQuotePane';
import { ReviewActionBar } from '../components/review/ReviewActionBar';
import { ErrorBanner } from '../components/inbox/ErrorBanner';

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Review · {heading}</h1>
        <div className="flex items-center gap-4">
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

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <Pane>
              <OriginalRequestPane request={request} onError={setDownloadError} />
            </Pane>
            <Pane>
              <ParsedStructurePane lines={request.line_items} />
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
