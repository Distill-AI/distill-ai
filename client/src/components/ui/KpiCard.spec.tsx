import { render, screen } from '@testing-library/react';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders the label and value', () => {
    render(<KpiCard label="Quotes this week" value="128" />);
    expect(screen.getByText('Quotes this week')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders the delta when provided', () => {
    render(<KpiCard label="Zero-edit approval" value="4.2%" delta="+41%" />);
    expect(screen.getByText('+41%')).toBeInTheDocument();
  });

  it('renders an upward trend icon for a positive delta', () => {
    const { container } = render(<KpiCard label="Zero-edit approval" value="4.2%" delta="+6pts" />);
    expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument();
    expect(container.querySelector('.lucide-trending-down')).not.toBeInTheDocument();
  });

  it('renders a downward trend icon for a negative delta', () => {
    const { container } = render(
      <KpiCard label="Auto-eligible false-neg" value="3%" delta="-2pts" />,
    );
    expect(container.querySelector('.lucide-trending-down')).toBeInTheDocument();
    expect(container.querySelector('.lucide-trending-up')).not.toBeInTheDocument();
  });

  it('omits the delta row when not provided', () => {
    const { container } = render(<KpiCard label="Crash recoveries" value="0" />);
    expect(container.querySelector('.text-hi-tx')).not.toBeInTheDocument();
  });
});
