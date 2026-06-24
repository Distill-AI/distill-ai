import { useMemo } from 'react';

interface StructuredOutputProps {
  data: Record<string, unknown> | null;
}

export function StructuredOutput({ data }: StructuredOutputProps) {
  const json = useMemo(() => {
    if (!data) return '';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-400">No output</div>
    );
  }

  return (
    <div className="rounded-lg bg-slate-900 p-4 overflow-auto max-h-[600px]">
      <pre className="font-mono text-sm leading-relaxed">
        <code className="text-gray-100">{json}</code>
      </pre>
    </div>
  );
}
