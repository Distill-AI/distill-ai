import { useParams } from 'react-router-dom';

export function Processing() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Processing request</h1>
      <p className="mt-2 text-sm text-body-text">Request ID: {id}</p>
    </div>
  );
}
