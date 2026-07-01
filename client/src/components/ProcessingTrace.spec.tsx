import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingTrace } from './ProcessingTrace';
import type { NodeState, SseConnectionState } from '../hooks/useSSEEvents';
import type { MatchedLine } from '../api/interface/line-item';

const mockNodes: NodeState[] = [
  { id: 'parse', name: 'parse', status: 'success', duration_ms: 500 },
  { id: 'extract', name: 'extract', status: 'success', duration_ms: 3000 },
  { id: 'classify', name: 'classify', status: 'success', duration_ms: 400 },
  { id: 'match', name: 'match', status: 'success', duration_ms: 2000 },
  { id: 'price', name: 'price', status: 'success', duration_ms: 800 },
  { id: 'policy', name: 'policy', status: 'success', duration_ms: 600 },
  { id: 'score', name: 'score', status: 'success', duration_ms: 500 },
];

const emptyNodes: NodeState[] = [
  { id: 'parse', name: 'parse', status: 'pending' },
  { id: 'extract', name: 'extract', status: 'pending' },
  { id: 'classify', name: 'classify', status: 'pending' },
  { id: 'match', name: 'match', status: 'pending' },
  { id: 'price', name: 'price', status: 'pending' },
  { id: 'policy', name: 'policy', status: 'pending' },
  { id: 'score', name: 'score', status: 'pending' },
];

const sampleLineItems: MatchedLine[] = [
  { position: 1, rawText: 'M12 Bolt x 50', skuLabel: 'BOLT-M12', confidence: 0.98 },
  { position: 2, rawText: 'Custom assembly', skuLabel: null, confidence: 0.64 },
  { position: 3, rawText: 'Nylon washer pack', skuLabel: 'WSHR-NYLON', confidence: 0.85 },
];

const defaultProps = {
  nodes: emptyNodes,
  connection: { status: 'connected' } as SseConnectionState,
  finalOutput: null as Record<string, unknown> | null,
  reconnect: vi.fn(),
};

describe('ProcessingTrace', () => {
  it('renders all 7 node names', () => {
    render(<ProcessingTrace {...defaultProps} />);
    expect(screen.getByText('parse')).toBeInTheDocument();
    expect(screen.getByText('extract')).toBeInTheDocument();
    expect(screen.getByText('classify')).toBeInTheDocument();
    expect(screen.getByText('match')).toBeInTheDocument();
    expect(screen.getByText('price')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
  });

  it('renders Extraction trace heading', () => {
    render(<ProcessingTrace {...defaultProps} />);
    expect(screen.getByText('Extraction trace')).toBeInTheDocument();
  });

  it('renders STRUCTURED OUTPUT heading', () => {
    render(<ProcessingTrace {...defaultProps} />);
    expect(screen.getByText('STRUCTURED OUTPUT')).toBeInTheDocument();
  });

  it('shows success nodes with checkmarks', () => {
    const { container } = render(<ProcessingTrace {...defaultProps} nodes={mockNodes} />);
    const checks = container.querySelectorAll('svg.lucide-check');
    expect(checks).toHaveLength(7);
  });

  it('shows error banner and reconnect button on connection error', () => {
    render(
      <ProcessingTrace
        {...defaultProps}
        connection={{ status: 'error', error: 'SSE connection lost' }}
      />,
    );
    expect(screen.getByText('SSE connection lost')).toBeInTheDocument();
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('calls reconnect when Reconnect button is clicked', async () => {
    const reconnect = vi.fn();
    render(
      <ProcessingTrace
        {...defaultProps}
        connection={{ status: 'error', error: 'SSE connection lost' }}
        reconnect={reconnect}
      />,
    );
    await userEvent.click(screen.getByText('Reconnect'));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('shows connecting message while connecting', () => {
    render(<ProcessingTrace {...defaultProps} connection={{ status: 'connecting' }} />);
    expect(screen.getByText('Connecting to live trace...')).toBeInTheDocument();
  });

  it('renders Matched Lines section when lineItems are provided', () => {
    render(<ProcessingTrace {...defaultProps} lineItems={sampleLineItems} />);
    expect(screen.getByText('Matched Lines')).toBeInTheDocument();
    expect(screen.getByText('M12 Bolt x 50')).toBeInTheDocument();
    expect(screen.getByText('Custom assembly')).toBeInTheDocument();
    expect(screen.getByText('Nylon washer pack')).toBeInTheDocument();
  });

  it('renders confidence chips for each matched line', () => {
    render(<ProcessingTrace {...defaultProps} lineItems={sampleLineItems} />);
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('does not render Matched Lines section when lineItems is empty', () => {
    render(<ProcessingTrace {...defaultProps} lineItems={[]} />);
    expect(screen.queryByText('Matched Lines')).not.toBeInTheDocument();
  });

  it('does not render Matched Lines section when lineItems is undefined', () => {
    render(<ProcessingTrace {...defaultProps} />);
    expect(screen.queryByText('Matched Lines')).not.toBeInTheDocument();
  });
});
