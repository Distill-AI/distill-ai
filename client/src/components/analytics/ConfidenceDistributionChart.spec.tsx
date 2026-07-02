import { render, screen } from '@testing-library/react';
import { ConfidenceDistributionChart } from './ConfidenceDistributionChart';

describe('ConfidenceDistributionChart', () => {
  it('renders a percentage label per tier', () => {
    render(<ConfidenceDistributionChart highPct={64} mediumPct={27} lowPct={9} />);
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('27%')).toBeInTheDocument();
    expect(screen.getByText('9%')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('does not crash when two tiers are zero', () => {
    render(<ConfidenceDistributionChart highPct={100} mediumPct={0} lowPct={0} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('scales each bar to its own percentage, not the largest tier', () => {
    const { container } = render(
      <ConfidenceDistributionChart highPct={64} mediumPct={27} lowPct={9} />,
    );
    const bars = container.querySelectorAll<HTMLElement>('.rounded-t');
    expect(bars[0].style.height).toBe('64%');
    expect(bars[1].style.height).toBe('27%');
    expect(bars[2].style.height).toBe('9%');
  });

  it('renders a "No data" message when all tiers are zero', () => {
    render(<ConfidenceDistributionChart highPct={0} mediumPct={0} lowPct={0} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText('High')).not.toBeInTheDocument();
  });

  it('clamps an out-of-range value to 100 instead of overflowing the track', () => {
    const { container } = render(
      <ConfidenceDistributionChart highPct={120} mediumPct={0} lowPct={0} />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    const bars = container.querySelectorAll<HTMLElement>('.rounded-t');
    expect(bars[0].style.height).toBe('100%');
  });

  it('treats a non-finite value as zero instead of emitting NaN%', () => {
    render(<ConfidenceDistributionChart highPct={NaN} mediumPct={0} lowPct={0} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  });
});
