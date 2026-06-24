import { useParams, Link } from 'react-router-dom';
import { ProcessingTrace } from '../components/ProcessingTrace';

export function ProcessingRequestPage() {
  const { id } = useParams<{ id?: string }>();
  if (!id) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-gray-500">No request ID provided.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
          &larr; Back to Inbox
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Processing Request</h1>
        <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-2 py-1">{id}</span>
      </div>
      <ProcessingTrace requestId={id} />
    </div>
  );
}
