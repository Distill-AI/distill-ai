import { useSSEEvents } from '../hooks/useSSEEvents';
import { TraceNode } from './TraceNode';
import { StructuredOutput } from './StructuredOutput';

interface ProcessingTraceProps {
  requestId: string;
}

export function ProcessingTrace({ requestId }: ProcessingTraceProps) {
  const { nodes, connection, finalOutput, reconnect } = useSSEEvents(requestId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Extraction Trace
        </h2>
        <div className="space-y-1">
          {nodes.map((node) => (
            <TraceNode key={node.id} {...node} />
          ))}
        </div>

        {connection.status === 'error' && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <span className="flex-1">{connection.error ?? 'Connection lost'}</span>
            <button
              type="button"
              onClick={reconnect}
              className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors"
            >
              Reconnect
            </button>
          </div>
        )}

        {connection.status === 'connecting' && (
          <div className="mt-4 text-center text-sm text-gray-400">Connecting to live trace...</div>
        )}
      </div>

      <div className="w-full lg:w-96">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Structured Output
        </h2>
        <StructuredOutput data={finalOutput} />
      </div>
    </div>
  );
}
