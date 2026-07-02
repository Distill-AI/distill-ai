import { render, screen } from '@testing-library/react';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders the label and value', () => {
    render(<KpiCard label="Quotes this week" value="128" />);
    expect(screen.getByText('Quotes this week')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders the delta when provided', () => {
    render(<KpiCard label="Zero-edit approval" value="4.2%" delta="+41%" sentiment="positive" />);
    expect(screen.getByText('+41%')).toBeInTheDocument();
  });

  it('renders an upward trend icon for a delta that increased, regardless of sentiment', () => {
    const { container } = render(
      <KpiCard label="Zero-edit approval" value="4.2%" delta="+6pts" sentiment="positive" />,
    );
    expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument();
    expect(container.querySelector('.lucide-trending-down')).not.toBeInTheDocument();
  });

  it('renders a downward trend icon for a delta that decreased, regardless of sentiment', () => {
    const { container } = render(
      <KpiCard label="Auto-eligible false-neg" value="3%" delta="-2pts" sentiment="positive" />,
    );
    expect(container.querySelector('.lucide-trending-down')).toBeInTheDocument();
    expect(container.querySelector('.lucide-trending-up')).not.toBeInTheDocument();
  });

  it('colours the delta with the success token when sentiment is positive, even for a falling value', () => {
    const { container } = render(
      <KpiCard label="Auto-eligible false-neg" value="3%" delta="-2pts" sentiment="positive" />,
    );
    expect(container.querySelector('.text-success-text')).toBeInTheDocument();
  });

  it('colours the delta red when sentiment is negative, even for a rising value', () => {
    const { container } = render(
      <KpiCard label="Auto-eligible false-neg" value="5%" delta="+2pts" sentiment="negative" />,
    );
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
  });

  it('falls back to a neutral colour when sentiment is omitted', () => {
    const { container } = render(<KpiCard label="Crash recoveries" value="2" delta="+1" />);
    expect(container.querySelector('.text-success-text')).not.toBeInTheDocument();
    expect(container.querySelector('.text-red-600')).not.toBeInTheDocument();
  });

  it('omits the delta row when not provided', () => {
    render(<KpiCard label="Crash recoveries" value="0" />);
    expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
  });
});
