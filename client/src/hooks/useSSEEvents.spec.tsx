import { renderHook, act } from '@testing-library/react';
import { useSSEEvents } from './useSSEEvents';

type EventListenerMap = Record<string, ((e: MessageEvent) => void) | null>;

let listeners: EventListenerMap = {};
let onOpen: (() => void) | null = null;
let onError: (() => void) | null = null;
let closeCount = 0;

function createMockEventSource(_url: string) {
  void _url;
  listeners = {};
  onOpen = null;
  onError = null;

  const es = {
    addEventListener: (event: string, handler: (e: MessageEvent) => void) => {
      listeners[event] = handler;
    },
    set onopen(fn: (() => void) | null) {
      onOpen = fn;
    },
    set onerror(fn: (() => void) | null) {
      onError = fn;
    },
    close: () => {
      closeCount++;
    },
  };
  return es;
}

function emitSSEEvent(event: string, data: Record<string, unknown>) {
  const handler = listeners[event];
  if (handler) {
    handler(new MessageEvent(event, { data: JSON.stringify(data) }));
  }
}

describe('useSSEEvents', () => {
  beforeEach(() => {
    listeners = {};
    onOpen = null;
    onError = null;
    closeCount = 0;
    vi.stubGlobal('EventSource', createMockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with all nodes in pending state', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    expect(result.current.nodes).toHaveLength(7);
    for (const node of result.current.nodes) {
      expect(node.status).toBe('pending');
    }
  });

  it('initializes nodes in correct pipeline order', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    const names = result.current.nodes.map((n) => n.name);
    expect(names).toEqual(['parse', 'extract', 'classify', 'match', 'price', 'policy', 'score']);
  });

  it('sets connecting status on mount', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    expect(result.current.connection.status).toBe('connecting');
  });

  it('sets connected status on open', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    expect(result.current.connection.status).toBe('connected');
  });

  it('updates node to in-progress on node.entered', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('node.entered', {
        type: 'node.entered',
        node: 'parse',
        status: 'processing',
        timestamp: new Date().toISOString(),
      });
    });
    const parse = result.current.nodes.find((n) => n.name === 'parse');
    expect(parse?.status).toBe('in-progress');
  });

  it('updates node to success on node.exited with success status', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('node.exited', {
        type: 'node.exited',
        node: 'parse',
        status: 'success',
        duration_ms: 500,
        summary: 'Done',
        timestamp: new Date().toISOString(),
      });
    });
    const parse = result.current.nodes.find((n) => n.name === 'parse');
    expect(parse?.status).toBe('success');
    expect(parse?.duration_ms).toBe(500);
  });

  it('updates node to failed on node.exited with failed status', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('node.exited', {
        type: 'node.exited',
        node: 'extract',
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
    });
    const extract = result.current.nodes.find((n) => n.name === 'extract');
    expect(extract?.status).toBe('failed');
  });

  it('sets tool_name and attempt on tool.invoked', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('tool.invoked', {
        type: 'tool.invoked',
        node: 'extract',
        tool_name: 'catalog_search',
        status: 'running',
        attempt: 1,
      });
    });
    const extract = result.current.nodes.find((n) => n.name === 'extract');
    expect(extract?.tool_name).toBe('catalog_search');
    expect(extract?.attempt).toBe(1);
  });

  it('sets finalOutput on processing.complete and closes connection', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('processing.complete', {
        type: 'processing.complete',
        timestamp: new Date().toISOString(),
        status: 'success',
        total_duration_ms: 10000,
      });
    });
    expect(result.current.finalOutput).toEqual({
      status: 'success',
      total_duration_ms: 10000,
    });
    expect(result.current.connection.status).toBe('disconnected');
  });

  it('sets error state on EventSource onerror', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      onError?.();
    });
    expect(result.current.connection.status).toBe('error');
    expect(result.current.connection.error).toBe('SSE connection lost');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSEEvents('req-1'));
    const prev = closeCount;
    unmount();
    expect(closeCount).toBeGreaterThan(prev);
  });

  it('updates node to failed with error on stage.error', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('stage.error', {
        event_type: 'stage.error',
        request_id: 'req-1',
        stage: 'extract',
        reason: 'llm_circuit_open',
        escalated_to_human: true,
        occurred_at: new Date().toISOString(),
      });
    });
    const extract = result.current.nodes.find((n) => n.name === 'extract');
    expect(extract?.status).toBe('failed');
    expect(extract?.error).toBe('llm_circuit_open');
  });

  it('tracks classify node events', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('node.entered', {
        type: 'node.entered',
        node: 'classify',
        status: 'processing',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.nodes.find((n) => n.name === 'classify')?.status).toBe('in-progress');

    act(() => {
      emitSSEEvent('node.exited', {
        type: 'node.exited',
        node: 'classify',
        status: 'success',
        duration_ms: 400,
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.nodes.find((n) => n.name === 'classify')?.status).toBe('success');
    expect(result.current.nodes.find((n) => n.name === 'classify')?.duration_ms).toBe(400);
  });

  it('replays a full pipeline fixture end-to-end', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });

    const pipeline = ['parse', 'extract', 'classify', 'match', 'price', 'policy', 'score'];
    for (const node of pipeline) {
      act(() => {
        emitSSEEvent('node.entered', {
          type: 'node.entered',
          node,
          status: 'processing',
          timestamp: new Date().toISOString(),
        });
      });
      act(() => {
        emitSSEEvent('node.exited', {
          type: 'node.exited',
          node,
          status: 'success',
          duration_ms: 100,
          timestamp: new Date().toISOString(),
        });
      });
    }

    for (const node of pipeline) {
      const n = result.current.nodes.find((x) => x.name === node);
      expect(n?.status).toBe('success');
      expect(n?.duration_ms).toBe(100);
    }
  });

  it('populates connection.resumed from request.resumed without dropping connected status', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('request.resumed', {
        type: 'request.resumed',
        request_id: 'req-1',
        resumed_from_node: 'classify',
        reason: 'crash_recovery',
      });
    });
    expect(result.current.connection.resumed).toEqual({ from: 'classify' });
    expect(result.current.connection.status).toBe('connected');
  });

  it('keeps connection.resumed set when a node event arrives afterwards', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('request.resumed', {
        type: 'request.resumed',
        request_id: 'req-1',
        resumed_from_node: 'match',
        reason: 'crash_recovery',
      });
    });
    act(() => {
      emitSSEEvent('node.entered', {
        type: 'node.entered',
        node: 'match',
        status: 'processing',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.connection.resumed).toEqual({ from: 'match' });
    expect(result.current.nodes.find((n) => n.name === 'match')?.status).toBe('in-progress');
  });

  it('backfills earlier nodes as success from a resumed-from snapshot', () => {
    // Reopening/resuming at `match`: parse/extract/classify ran before this connection opened.
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'match', status: 'parsing' }),
    );
    const byName = (n: string) => result.current.nodes.find((x) => x.name === n)?.status;
    expect(byName('parse')).toBe('success');
    expect(byName('extract')).toBe('success');
    expect(byName('classify')).toBe('success');
    expect(byName('match')).toBe('pending');
    expect(byName('price')).toBe('pending');
  });

  it('does not let the snapshot override a live event that already advanced a node', () => {
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'match', status: 'parsing' }),
    );
    act(() => onOpen?.());
    act(() => {
      emitSSEEvent('node.exited', {
        type: 'node.exited',
        node: 'match',
        status: 'success',
        duration_ms: 300,
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.nodes.find((n) => n.name === 'match')?.status).toBe('success');
    expect(result.current.nodes.find((n) => n.name === 'match')?.duration_ms).toBe(300);
  });

  it('marks the whole trace success and seeds output when reopening a settled request', () => {
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'done', status: 'needs_review' }),
    );
    for (const node of result.current.nodes) {
      expect(node.status).toBe('success');
    }
    expect(result.current.finalOutput).toEqual({ status: 'needs_review' });
  });

  it('treats a settled "ready" status as fully complete (matches RequestStatus)', () => {
    // Regression for the approved/PDF-ready state: it must settle the trace like needs_review.
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'done', status: 'ready' }),
    );
    for (const node of result.current.nodes) {
      expect(node.status).toBe('success');
    }
    expect(result.current.finalOutput).toEqual({ status: 'ready' });
  });

  it('does not mark the trace all-success for a failed request', () => {
    // `failed` is not a settled-success status: the run did not complete every node.
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'classify', status: 'failed' }),
    );
    // Only nodes before the current one are backfilled; nothing is force-marked success.
    expect(result.current.nodes.find((n) => n.name === 'score')?.status).toBe('pending');
    expect(result.current.finalOutput).toBeNull();
  });

  it('does not backfill for a fresh request still at parse', () => {
    const { result } = renderHook(() =>
      useSSEEvents('req-1', { currentNode: 'parse', status: 'parsing' }),
    );
    for (const node of result.current.nodes) {
      expect(node.status).toBe('pending');
    }
    expect(result.current.finalOutput).toBeNull();
  });

  it('does not set connection.resumed for an uninterrupted run (AC-04, no false positive)', () => {
    const { result } = renderHook(() => useSSEEvents('req-1'));
    act(() => {
      onOpen?.();
    });
    act(() => {
      emitSSEEvent('node.entered', {
        type: 'node.entered',
        node: 'parse',
        status: 'processing',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.connection.resumed).toBeUndefined();
  });

  it('does nothing when requestId is null', () => {
    const { result } = renderHook(() => useSSEEvents(null));
    expect(result.current.nodes).toHaveLength(7);
    expect(result.current.connection.status).toBe('disconnected');
  });
});
