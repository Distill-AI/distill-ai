import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRequest } from '../api/requests';
import { OriginalRequestPane } from '../components/review/OriginalRequestPane';
import { ErrorBanner } from '../components/inbox/ErrorBanner';

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
      )}
    </div>
  );
}
