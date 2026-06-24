import { useParams, Link } from 'react-router-dom';

export function Processing() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Processing request</h1>
        {id && (
          <Link
            to={`/requests/${id}/review`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Open review
          </Link>
        )}
      </div>
      <p className="mt-2 text-sm text-body-text">Request ID: {id}</p>
    </div>
  );
}
