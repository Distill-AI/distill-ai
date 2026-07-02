import { useState, useEffect, useRef, useCallback } from 'react';

export interface SseNodeEvent {
  type: 'node.entered' | 'node.exited';
  timestamp: string;
  node: string;
  status: string;
  duration_ms?: number;
  summary?: string;
}

export interface SseToolEvent {
  type: 'tool.invoked';
  timestamp: string;
  node?: string;
  tool_name: string;
  status: string;
  attempt: number;
  result_summary?: string;
}

export interface SseErrorEvent {
  event_type: 'stage.error';
  request_id: string;
  stage: string;
  reason: string;
  escalated_to_human: true;
  occurred_at: string;
}

export interface SseCompleteEvent {
  type: 'processing.complete';
  timestamp: string;
  status: string;
  total_duration_ms?: number;
}

export interface SseResumedEvent {
  type: 'request.resumed';
  request_id: string;
  resumed_from_node: string;
  reason?: string;
}

export type SseEvent =
  | SseNodeEvent
  | SseToolEvent
  | SseErrorEvent
  | SseCompleteEvent
  | SseResumedEvent;

export interface NodeState {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'success' | 'failed';
  tool_name?: string;
  attempt?: number;
  duration_ms?: number;
  summary?: string;
  error?: string;
}

export interface SseConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  /** Set when the backend emits `request.resumed`, i.e. the pipeline continued from a checkpoint. */
  resumed?: { from: string };
}

const NODE_ORDER = ['parse', 'extract', 'classify', 'match', 'price', 'policy', 'score'];

// Statuses that mean the pipeline ran to completion, so the whole trace has already executed. These
// match RequestStatus on the server; `failed` and `needs_clarification` are excluded because the
// trace did not complete successfully (marking every node done would be wrong).
const SETTLED_STATUSES = new Set(['needs_review', 'priced', 'ready', 'sent', 'declined']);

/**
 * How many leading nodes are already done given the request's persisted `current_node`. Live events
 * only cover stages that run after the SSE connection opens; on (re)connect to a request that has
 * already advanced (a resume, or reopening a finished request) this backfills the earlier nodes so
 * the trace matches reality instead of showing everything as pending.
 */
function completedNodeCount(currentNode?: string, status?: string): number {
  if (status && SETTLED_STATUSES.has(status)) return NODE_ORDER.length;
  if (!currentNode) return 0;
  const idx = NODE_ORDER.indexOf(currentNode);
  return idx >= 0 ? idx : 0;
}

/** A persisted snapshot from GET /requests/:id used to backfill trace state the live stream missed. */
export interface RequestSnapshot {
  currentNode?: string;
  status?: string;
}

export function useSSEEvents(
  requestId: string | null,
  snapshot?: RequestSnapshot | null,
): {
  nodes: NodeState[];
  connection: SseConnectionState;
  finalOutput: Record<string, unknown> | null;
  reconnect: () => void;
} {
  const [nodes, setNodes] = useState<NodeState[]>(() =>
    NODE_ORDER.map((name) => ({ id: name, name, status: 'pending' })),
  );

  const [connection, setConnection] = useState<SseConnectionState>({ status: 'disconnected' });
  const [finalOutput, setFinalOutput] = useState<Record<string, unknown> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivity = useCallback(() => {
    if (inactivityRef.current) {
      clearTimeout(inactivityRef.current);
      inactivityRef.current = null;
    }
  }, []);

  const resetInactivity = useCallback(() => {
    clearInactivity();
    inactivityRef.current = setTimeout(() => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnection({ status: 'error', error: 'Node timeout: no activity for 60s' });
    }, 60_000);
  }, [clearInactivity]);

  const close = useCallback(() => {
    clearInactivity();
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [clearInactivity]);

  const connect = useCallback(() => {
    if (!requestId) return;

    close();
    setConnection({ status: 'connecting' });
    setNodes(NODE_ORDER.map((name) => ({ id: name, name, status: 'pending' })));
    setFinalOutput(null);

    const es = new EventSource(`/api/v1/requests/${requestId}/events`);
    esRef.current = es;

    es.onopen = () => {
      setConnection({ status: 'connected' });
      resetInactivity();
    };

    es.addEventListener('node.entered', (e: MessageEvent) => {
      resetInactivity();
      try {
        const data = JSON.parse(e.data) as SseNodeEvent;
        setNodes((prev) =>
          prev.map((n) => (n.name === data.node ? { ...n, status: 'in-progress' } : n)),
        );
      } catch {
        // Ignore malformed events; connection remains active
      }
    });
    es.addEventListener('node.exited', (e: MessageEvent) => {
      resetInactivity();
      try {
        const data = JSON.parse(e.data) as SseNodeEvent;
        setNodes((prev) =>
          prev.map((n) =>
            n.name === data.node
              ? {
                  ...n,
                  status: data.status === 'success' ? 'success' : 'failed',
                  duration_ms: data.duration_ms,
                  summary: data.summary,
                }
              : n,
          ),
        );
      } catch {
        // Ignore malformed events; connection remains active
      }
    });
    es.addEventListener('tool.invoked', (e: MessageEvent) => {
      resetInactivity();
      try {
        const data = JSON.parse(e.data) as SseToolEvent;
        setNodes((prev) =>
          prev.map((n) => {
            if (!data.node) return n;
            if (n.name !== data.node) return n;
            return {
              ...n,
              status: data.status === 'running' ? 'in-progress' : n.status,
              tool_name: data.tool_name,
              attempt: data.attempt,
            };
          }),
        );
      } catch {
        // Ignore malformed events; connection remains active
      }
    });
    es.addEventListener('stage.error', (e: MessageEvent) => {
      resetInactivity();
      try {
        const data = JSON.parse(e.data) as SseErrorEvent;
        setNodes((prev) =>
          prev.map((n) =>
            n.name === data.stage ? { ...n, status: 'failed', error: data.reason } : n,
          ),
        );
      } catch {
        // Ignore malformed events; connection remains active
      }
    });

    es.addEventListener('request.resumed', (e: MessageEvent) => {
      resetInactivity();
      try {
        const data = JSON.parse(e.data) as SseResumedEvent;
        // Merge, don't replace: a node.entered can arrive right after and must not clear `resumed`.
        setConnection((prev) => ({ ...prev, resumed: { from: data.resumed_from_node } }));
      } catch {
        // Ignore malformed events; connection remains active
      }
    });

    es.addEventListener('processing.complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SseCompleteEvent;
        setFinalOutput({ status: data.status, total_duration_ms: data.total_duration_ms });
        close();
        setConnection({ status: 'disconnected' });
      } catch {
        // Ignore malformed events; connection remains active
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnection({ status: 'error', error: 'SSE connection lost' });
      clearInactivity();
    };
  }, [requestId, close, resetInactivity, clearInactivity]);

  useEffect(() => {
    // connect() sets up EventSource with async callbacks; setState only runs in event handlers
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();
    return () => close();
  }, [connect, close]);

  const snapshotNode = snapshot?.currentNode;
  const snapshotStatus = snapshot?.status;
  useEffect(() => {
    const done = completedNodeCount(snapshotNode, snapshotStatus);
    const settled = Boolean(snapshotStatus && SETTLED_STATUSES.has(snapshotStatus));
    if (done === 0 && !settled) return;
    // Layer over the live stream: only fill nodes still pending, so a live node.entered/exited that
    // already arrived always wins.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((prev) =>
      prev.map((n, i) => (i < done && n.status === 'pending' ? { ...n, status: 'success' } : n)),
    );

    if (settled) setFinalOutput((prev) => prev ?? { status: snapshotStatus });
  }, [snapshotNode, snapshotStatus]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  return { nodes, connection, finalOutput, reconnect };
}
