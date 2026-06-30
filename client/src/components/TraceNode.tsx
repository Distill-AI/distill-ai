import { Check, Loader2 } from 'lucide-react';

interface TraceNodeProps {
  name: string;
  status: 'pending' | 'in-progress' | 'success' | 'failed';
  tool_name?: string;
  duration_ms?: number;
  summary?: string;
  error?: string;
}

function StatusIcon({ status }: { status: TraceNodeProps['status'] }) {
  if (status === 'success') {
    return <Check className="h-4 w-4 text-success-icon" aria-hidden="true" />;
  }
  if (status === 'in-progress') {
    return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" aria-hidden="true" />;
  }
  if (status === 'failed') {
    return (
      <span className="h-4 w-4 text-red-400 text-sm font-bold" aria-hidden="true">
        ✗
      </span>
    );
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-body-text" aria-hidden="true" />;
}

export function TraceNode({
  name,
  status,
  tool_name,
  duration_ms,
  summary,
  error,
}: TraceNodeProps) {
  const showTool = tool_name && (status === 'success' || status === 'in-progress');
  const durationLabel = duration_ms !== undefined ? `${(duration_ms / 1000).toFixed(1)}s` : null;
  const statusLabel = status === 'success' ? 'ok' : 'running';

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-3" aria-label={`${name}: ${status}`}>
        <StatusIcon status={status} />
        <span
          className={`font-mono text-[13px] ${status === 'pending' ? 'text-muted' : 'text-white'}`}
        >
          {name}
        </span>
        {duration_ms !== undefined && (
          <span className="text-xs text-muted whitespace-nowrap">{duration_ms}ms</span>
        )}
        {summary && status === 'success' && (
          <span className="hidden text-xs text-muted truncate max-w-50 lg:inline">{summary}</span>
        )}
        {error && status === 'failed' && (
          <span className="text-xs text-red-400 truncate max-w-50" title={error}>
            {error}
          </span>
        )}
      </div>
      {showTool && (
        <div className="ml-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-medium font-mono">
            🔧 {tool_name}
            {durationLabel && ` · ${durationLabel}`}
            {' · '}
            <span className={status === 'success' ? 'text-success-text' : 'text-indigo-700'}>
              {statusLabel}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
