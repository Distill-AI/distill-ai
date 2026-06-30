import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ProcessingTrace } from '../components/ProcessingTrace';
import { usePageHeader } from '../context/PageHeaderContext';

export function ProcessingRequestPage() {
  const { id } = useParams<{ id?: string }>();
  const { setTitle } = usePageHeader();

  useEffect(() => {
    setTitle('Processing request');
    return () => setTitle(null);
  }, [setTitle]);

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
