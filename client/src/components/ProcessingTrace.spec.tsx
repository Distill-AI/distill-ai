import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingTrace } from './ProcessingTrace';
import type { NodeState, SseConnectionState } from '../hooks/useSSEEvents';

const mockNodes: NodeState[] = [
  { id: 'parse', name: 'parse', status: 'success', duration_ms: 500 },
  { id: 'extract', name: 'extract', status: 'success', duration_ms: 3000 },
  { id: 'match', name: 'match', status: 'success', duration_ms: 2000 },
  { id: 'score', name: 'score', status: 'success', duration_ms: 500 },
  { id: 'price', name: 'price', status: 'success', duration_ms: 800 },
  { id: 'policy', name: 'policy', status: 'success', duration_ms: 600 },
];

const emptyNodes: NodeState[] = [
  { id: 'parse', name: 'parse', status: 'pending' },
  { id: 'extract', name: 'extract', status: 'pending' },
  { id: 'match', name: 'match', status: 'pending' },
  { id: 'score', name: 'score', status: 'pending' },
  { id: 'price', name: 'price', status: 'pending' },
  { id: 'policy', name: 'policy', status: 'pending' },
];

let mockHook = {
  nodes: emptyNodes,
  connection: { status: 'connected' } as SseConnectionState,
  finalOutput: null as Record<string, unknown> | null,
  reconnect: vi.fn(),
};

vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: () => mockHook,
}));

describe('ProcessingTrace', () => {
  afterEach(() => {
    mockHook = {
      nodes: emptyNodes,
      connection: { status: 'connected' },
      finalOutput: null,
      reconnect: vi.fn(),
    };
  });

  it('renders all 6 node names', () => {
    render(<ProcessingTrace requestId="test-uuid" />);
    expect(screen.getByText('parse')).toBeInTheDocument();
    expect(screen.getByText('extract')).toBeInTheDocument();
    expect(screen.getByText('match')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
    expect(screen.getByText('price')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();
  });

  it('renders Extraction Trace heading', () => {
    render(<ProcessingTrace requestId="test-uuid" />);
    expect(screen.getByText('Extraction Trace')).toBeInTheDocument();
  });

  it('renders Structured Output heading', () => {
    render(<ProcessingTrace requestId="test-uuid" />);
    expect(screen.getByText('Structured Output')).toBeInTheDocument();
  });

  it('shows success nodes with checkmarks', () => {
    mockHook = { ...mockHook, nodes: mockNodes };
    render(<ProcessingTrace requestId="test-uuid" />);
    const checks = screen.getAllByText('\u2713');
    expect(checks).toHaveLength(6);
  });

  it('shows error banner and reconnect button on connection error', () => {
    mockHook = {
      ...mockHook,
      connection: { status: 'error', error: 'SSE connection lost' },
    };
    render(<ProcessingTrace requestId="test-uuid" />);
    expect(screen.getByText('SSE connection lost')).toBeInTheDocument();
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('calls reconnect when Reconnect button is clicked', async () => {
    const reconnect = vi.fn();
    mockHook = {
      ...mockHook,
      connection: { status: 'error', error: 'SSE connection lost' },
      reconnect,
    };
    render(<ProcessingTrace requestId="test-uuid" />);
    await userEvent.click(screen.getByText('Reconnect'));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('shows connecting message while connecting', () => {
    mockHook = {
      ...mockHook,
      connection: { status: 'connecting' },
    };
    render(<ProcessingTrace requestId="test-uuid" />);
    expect(screen.getByText('Connecting to live trace...')).toBeInTheDocument();
  });
});
