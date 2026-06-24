import { render, screen } from '@testing-library/react';
import { StructuredOutput } from './StructuredOutput';

describe('StructuredOutput', () => {
  it('renders pretty-printed JSON when data is provided', () => {
    const data = { status: 'success', total_duration_ms: 10000 };
    render(<StructuredOutput data={data} />);
    expect(screen.getByText(/10000/)).toBeInTheDocument();
    expect(screen.getByText(/success/)).toBeInTheDocument();
  });

  it('shows "No output" placeholder when data is null', () => {
    render(<StructuredOutput data={null} />);
    expect(screen.getByText('No output')).toBeInTheDocument();
  });

  it('renders in a pre/code block with font-mono', () => {
    const data = { key: 'value' };
    render(<StructuredOutput data={data} />);
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.className).toContain('font-mono');
  });
});
