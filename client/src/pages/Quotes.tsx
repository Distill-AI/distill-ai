import { useEffect } from 'react';
import { usePageHeader } from '../context/PageHeaderContext';

export function Quotes() {
  const { setTitle } = usePageHeader();

  useEffect(() => {
    setTitle(<h1 className="truncate text-lg font-semibold text-slate-900">Quotes</h1>);
    return () => setTitle(null);
  }, [setTitle]);

  return <div className="px-6 py-6" />;
}
