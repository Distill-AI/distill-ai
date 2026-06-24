interface TraceNodeProps {
  name: string;
  status: 'pending' | 'in-progress' | 'success' | 'failed';
  tool_name?: string;
  attempt?: number;
  duration_ms?: number;
  summary?: string;
  error?: string;
}

const statusIcons: Record<TraceNodeProps['status'], string> = {
  pending: '\u2022',
  'in-progress': '\u27F3',
  success: '\u2713',
  failed: '\u2717',
};

const statusColors: Record<TraceNodeProps['status'], string> = {
  pending: 'text-gray-400',
  'in-progress': 'text-blue-400',
  success: 'text-green-400',
  failed: 'text-red-400',
};

const statusBg: Record<TraceNodeProps['status'], string> = {
  pending: 'bg-gray-50',
  'in-progress': 'bg-blue-50',
  success: 'bg-green-50',
  failed: 'bg-red-50',
};

export function TraceNode({
  name,
  status,
  tool_name,
  attempt,
  duration_ms,
  summary,
  error,
}: TraceNodeProps) {
  const showTool =
    status === 'in-progress' && tool_name && (name === 'extract' || name === 'match');

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${statusBg[status]}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center text-sm font-bold ${statusColors[status]} ${status === 'in-progress' ? 'animate-spin' : ''}`}
        aria-label={status}
      >
        {statusIcons[status]}
      </span>
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span
          className={`text-sm font-medium capitalize ${status === 'pending' ? 'text-gray-400' : 'text-slate-900'}`}
        >
          {name}
        </span>
        {showTool && (
          <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {tool_name}
            {attempt ? ` (attempt ${attempt})` : ''}
          </span>
        )}
      </div>
      {duration_ms !== undefined && (
        <span className="text-xs text-gray-400 whitespace-nowrap">{duration_ms}ms</span>
      )}
      {summary && status === 'success' && (
        <span className="hidden text-xs text-gray-500 truncate max-w-[200px] lg:inline">
          {summary}
        </span>
      )}
      {error && status === 'failed' && (
        <span className="text-xs text-red-500 truncate max-w-[200px]" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
