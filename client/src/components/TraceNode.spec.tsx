import { render, screen } from '@testing-library/react';
import { TraceNode } from './TraceNode';

describe('TraceNode', () => {
  it('renders node name', () => {
    render(<TraceNode name="parse" status="pending" />);
    expect(screen.getByText('parse')).toBeInTheDocument();
  });

  it('shows pending bullet and muted label', () => {
    const { container } = render(<TraceNode name="parse" status="pending" />);
    expect(container.querySelector('.bg-body-text')).toBeInTheDocument();
    expect(screen.getByText('parse').className).toContain('text-muted');
  });

  it('shows in-progress icon with spin animation', () => {
    const { container } = render(<TraceNode name="extract" status="in-progress" />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('class')).toContain('animate-spin');
    expect(icon?.getAttribute('class')).toContain('text-blue-400');
  });

  it('shows success checkmark icon', () => {
    const { container } = render(<TraceNode name="parse" status="success" />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('class')).toContain('text-success-icon');
  });

  it('exposes node status to assistive tech via row aria-label', () => {
    render(<TraceNode name="extract" status="in-progress" />);
    expect(screen.getByLabelText('extract: in-progress')).toBeInTheDocument();
  });

  it('shows failed cross in red', () => {
    render(<TraceNode name="extract" status="failed" />);
    const icon = screen.getByText('\u2717');
    expect(icon).toBeInTheDocument();
    expect(icon.className).toContain('text-red-400');
  });

  it('shows tool tag for extract node when in-progress', () => {
    render(
      <TraceNode name="extract" status="in-progress" tool_name="catalog_search" attempt={1} />,
    );
    expect(screen.getByText(/catalog_search/)).toBeInTheDocument();
    expect(screen.getByText(/attempt 1/)).toBeInTheDocument();
  });

  it('shows tool tag for match node when in-progress', () => {
    render(<TraceNode name="match" status="in-progress" tool_name="semantic_search" attempt={2} />);
    expect(screen.getByText(/semantic_search/)).toBeInTheDocument();
    expect(screen.getByText(/attempt 2/)).toBeInTheDocument();
  });

  it('shows no tool tag for score node even when in-progress', () => {
    render(<TraceNode name="score" status="in-progress" tool_name="some_tool" />);
    expect(screen.queryByText('some_tool')).not.toBeInTheDocument();
  });

  it('shows no tool tag for completed node', () => {
    render(<TraceNode name="extract" status="success" tool_name="catalog_search" />);
    expect(screen.queryByText('catalog_search')).not.toBeInTheDocument();
  });

  it('shows duration when provided', () => {
    render(<TraceNode name="parse" status="success" duration_ms={500} />);
    expect(screen.getByText('500ms')).toBeInTheDocument();
  });

  it('shows summary for success node', () => {
    render(<TraceNode name="parse" status="success" summary="Parsed email" />);
    expect(screen.getByText('Parsed email')).toBeInTheDocument();
  });

  it('renders with white name text for non-pending status', () => {
    render(<TraceNode name="parse" status="success" />);
    expect(screen.getByText('parse').className).toContain('text-white');
  });

  it('shows error text when status is failed and error is provided', () => {
    render(<TraceNode name="extract" status="failed" error="LLM API returned 429" />);
    expect(screen.getByText('LLM API returned 429')).toBeInTheDocument();
  });

  it('does not show error text when status is not failed', () => {
    render(<TraceNode name="extract" status="success" error="LLM API returned 429" />);
    expect(screen.queryByText('LLM API returned 429')).not.toBeInTheDocument();
  });
});
