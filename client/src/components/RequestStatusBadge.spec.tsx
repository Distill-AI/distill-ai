import { render, screen } from '@testing-library/react';
import { RequestStatusBadge } from './RequestStatusBadge';
import type { RequestStatus } from '../api/interface/request-status';

const cases: { status: RequestStatus; label: string }[] = [
  { status: 'received', label: 'Received' },
  { status: 'parsing', label: 'Parsing' },
  { status: 'needs_review', label: 'Needs review' },
  { status: 'priced', label: 'Priced' },
  { status: 'ready', label: 'Ready' },
  { status: 'sent', label: 'Sent' },
  { status: 'declined', label: 'Declined' },
  { status: 'needs_clarification', label: 'Needs clarification' },
  { status: 'failed', label: 'Failed' },
];

describe('RequestStatusBadge', () => {
  it.each(cases)('renders the "$label" label for status $status', ({ status, label }) => {
    render(<RequestStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('applies the parsing palette and a pulsing dot for parsing', () => {
    const { container } = render(<RequestStatusBadge status="parsing" />);
    expect(container.firstChild).toHaveClass('bg-parse-bg', 'text-parse-tx');
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders a warning icon for failed', () => {
    const { container } = render(<RequestStatusBadge status="failed" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-red-100', 'text-red-700');
  });
});
