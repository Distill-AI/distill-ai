import { render, screen } from '@testing-library/react';
import { StructuredOutput } from './StructuredOutput';

describe('StructuredOutput', () => {
  it('renders pretty-printed JSON when data is provided', () => {
    const data = { status: 'success', total_duration_ms: 10000 };
    render(<StructuredOutput data={data} />);
    expect(screen.getByText(/10000/)).toBeInTheDocument();
    expect(screen.getByText(/success/)).toBeInTheDocument();
  });

  it('shows "No output" placeholder with muted styling when data is null', () => {
    render(<StructuredOutput data={null} />);
    const placeholder = screen.getByText('No output');
    expect(placeholder.className).toContain('text-muted');
    expect(placeholder.className).not.toContain('bg-gray-50');
  });

  it('renders in a pre/code block with font-mono', () => {
    const data = { key: 'value' };
    render(<StructuredOutput data={data} />);
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.className).toContain('font-mono');
  });

  it('colors object keys with the accent token', () => {
    render(<StructuredOutput data={{ company: 'Acme' }} />);
    expect(screen.getByText('"company"').className).toContain('text-accent');
  });

  it('colors string values with the success-text token', () => {
    render(<StructuredOutput data={{ company: 'Acme' }} />);
    expect(screen.getByText('"Acme"').className).toContain('text-success-text');
  });

  it('collapses array values to a "[ n items ]" placeholder instead of expanding them', () => {
    render(<StructuredOutput data={{ line_items: [1, 2, 3] }} />);
    const placeholder = screen.getByText('[ 3 items ]');
    expect(placeholder.className).toContain('text-body-text');
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('uses singular "item" when the array has exactly one element', () => {
    render(<StructuredOutput data={{ line_items: [1] }} />);
    expect(screen.getByText('[ 1 item ]')).toBeInTheDocument();
  });
});
