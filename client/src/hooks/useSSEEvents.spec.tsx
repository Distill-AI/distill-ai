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
        type: 'stage.error',
        timestamp: new Date().toISOString(),
        node: 'extract',
        error: 'LLM API returned 429',
      });
    });
    const extract = result.current.nodes.find((n) => n.name === 'extract');
    expect(extract?.status).toBe('failed');
    expect(extract?.error).toBe('LLM API returned 429');
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

  it('does nothing when requestId is null', () => {
    const { result } = renderHook(() => useSSEEvents(null));
    expect(result.current.nodes).toHaveLength(7);
    expect(result.current.connection.status).toBe('disconnected');
  });
});
