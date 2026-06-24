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

export interface SseCompleteEvent {
  type: 'processing.complete';
  timestamp: string;
  status: string;
  total_duration_ms?: number;
}

export type SseEvent = SseNodeEvent | SseToolEvent | SseCompleteEvent;

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
}

const NODE_ORDER = ['parse', 'extract', 'match', 'score', 'price', 'policy'];

export function useSSEEvents(requestId: string | null): {
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

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  return { nodes, connection, finalOutput, reconnect };
}
