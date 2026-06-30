import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProcessingTrace } from '../components/ProcessingTrace';
import { usePageHeader } from '../context/PageHeaderContext';
import { ChevronLeftIcon } from '../components/ui/ChevronLeftIcon';

export function ProcessingRequestPage() {
  const { id } = useParams<{ id?: string }>();
  const { setTitle, setActions } = usePageHeader();

  useEffect(() => {
    setTitle(
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className="flex h-8 w-8 flex-none items-center justify-center rounded text-body-text hover:bg-canvas"
          aria-label="Back to inbox"
        >
          <ChevronLeftIcon />
        </Link>
        <h1 className="truncate text-lg font-semibold text-slate-900">Processing Request</h1>
      </div>,
    );
    return () => setTitle(null);
  }, [setTitle]);

  useEffect(() => {
    if (!id) {
      setActions(null);
      return;
    }
    setActions(
      <Link
        to={`/requests/${id}/review`}
        className="flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-indigo-600 shadow-sm hover:bg-canvas"
      >
        Open review
      </Link>,
    );
    return () => setActions(null);
  }, [id, setActions]);

  if (!id) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-gray-500">No request ID provided.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <ProcessingTrace requestId={id} />
    </div>
  );
}
