import { RotateCw } from 'lucide-react';
import { TraceNode } from './TraceNode';
import { MatchedLineRow } from './MatchedLineRow';
import { StructuredOutput } from './StructuredOutput';
import type { NodeState, SseConnectionState } from '../hooks/useSSEEvents';
import type { MatchedLine } from '../api/interface/line-item';
import type { ConfidenceThresholds } from '../config/thresholds';

interface ProcessingTraceProps {
  nodes: NodeState[];
  connection: SseConnectionState;
  finalOutput: Record<string, unknown> | null;
  reconnect: () => void;
  lineItems?: MatchedLine[];
  thresholds?: ConfidenceThresholds;
}

export function ProcessingTrace({
  nodes,
  connection,
  finalOutput,
  reconnect,
  lineItems,
  thresholds,
}: ProcessingTraceProps) {
  const resumed = connection.resumed;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-900 overflow-hidden flex flex-col">
          {resumed && (
            <div className="bg-slate-800 border-l-[3px] border-accent px-4 py-3 flex items-center gap-3">
              <RotateCw className="h-3.5 w-3.5 text-banner-text" aria-hidden="true" />
              <span className="font-mono text-xs text-banner-text">
                {`Resumed from ${resumed.from} after interruption`}
              </span>
            </div>
          )}
          <div className="p-5 flex flex-col flex-1">
            <h3 className="font-semibold text-[15px] text-white mb-6">Extraction trace</h3>
            <div className="space-y-1" role="status" aria-live="polite">
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
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col shadow-sm">
          <span className="block mb-4 text-[11px] font-semibold tracking-[0.5px] text-muted uppercase">
            STRUCTURED OUTPUT
          </span>
          <StructuredOutput data={finalOutput} />
        </div>
      </div>

      {lineItems && lineItems.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-body-text uppercase tracking-wide">
            Matched Lines
          </h2>
          <div className="space-y-0.5">
            {lineItems.map((line, idx) => (
              <MatchedLineRow key={`${line.position}-${idx}`} line={line} thresholds={thresholds} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
