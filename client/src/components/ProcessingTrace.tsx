import { useSSEEvents } from '../hooks/useSSEEvents';
import { TraceNode } from './TraceNode';
import { MatchedLineRow } from './MatchedLineRow';
import { StructuredOutput } from './StructuredOutput';
import type { MatchedLine } from '../api/interface/line-item';
import type { ConfidenceThresholds } from '../config/thresholds';

interface ProcessingTraceProps {
  requestId: string;
  lineItems?: MatchedLine[];
  thresholds?: ConfidenceThresholds;
}

export function ProcessingTrace({ requestId, lineItems, thresholds }: ProcessingTraceProps) {
  const { nodes, connection, finalOutput, reconnect } = useSSEEvents(requestId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-body-text uppercase tracking-wide">
            Extraction Trace
          </h2>
          <div className="space-y-1">
            {nodes.map((node) => (
              <TraceNode key={node.id} {...node} />
            ))}
          </div>

          {connection.status === 'error' && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-lo-bg/30 p-3 text-sm text-lo-tx">
              <span className="flex-1">{connection.error ?? 'Connection lost'}</span>
              <button
                type="button"
                onClick={reconnect}
                className="rounded bg-lo-bg/60 px-3 py-1 text-xs font-medium text-lo-tx hover:bg-lo-bg/80 transition-colors"
              >
                Reconnect
              </button>
            </div>
          )}

          {connection.status === 'connecting' && (
            <div className="mt-4 text-center text-sm text-muted">Connecting to live trace...</div>
          )}
        </div>

        <div className="w-full lg:w-96">
          <h2 className="mb-3 text-sm font-semibold text-body-text uppercase tracking-wide">
            Run Summary
          </h2>
          <StructuredOutput data={finalOutput} />
        </div>
      </div>

      {lineItems && lineItems.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-body-text uppercase tracking-wide">
            Matched Lines
          </h2>
          <div className="space-y-0.5">
            {lineItems.map((line) => (
              <MatchedLineRow key={line.position} line={line} thresholds={thresholds} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
