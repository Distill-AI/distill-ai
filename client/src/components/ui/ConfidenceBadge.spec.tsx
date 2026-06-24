import { render, screen } from '@testing-library/react';
import { ConfidenceBadge } from './ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('renders a dash when value is null', () => {
    render(<ConfidenceBadge value={null} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('rounds the fraction to a whole percentage', () => {
    render(<ConfidenceBadge value={0.846} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('clamps out-of-range values to 0-100%', () => {
    render(<ConfidenceBadge value={1.5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('uses the high tier at or above 85%', () => {
    const { container } = render(<ConfidenceBadge value={0.96} />);
    expect(container.firstChild).toHaveClass('bg-hi-bg', 'text-hi-tx');
  });

  it('uses the medium tier between 65% and 84%', () => {
    const { container } = render(<ConfidenceBadge value={0.78} />);
    expect(container.firstChild).toHaveClass('bg-md-bg', 'text-md-tx');
  });

  it('uses the low tier below 65%', () => {
    const { container } = render(<ConfidenceBadge value={0.5} />);
    expect(container.firstChild).toHaveClass('bg-lo-bg', 'text-lo-tx');
  });
});
