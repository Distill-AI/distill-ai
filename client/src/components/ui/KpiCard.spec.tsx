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

  it('omits the delta row when not provided', () => {
    const { container } = render(<KpiCard label="Crash recoveries" value="0" />);
    expect(container.querySelector('.text-hi-tx')).not.toBeInTheDocument();
  });
});
