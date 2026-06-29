import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutingReasonsBanner } from './RoutingReasonsBanner';
import type { RoutingReason } from '../../api/requests';

const reasons: RoutingReason[] = [
  { code: 'low_line_confidence', message: 'Line confidence 0.64 below auto threshold 0.95', source: 'confidence' },
  { code: 'deal_value_cap', message: 'Deal value $45,000 exceeds auto-send cap $20,000', source: 'value' },
];

describe('RoutingReasonsBanner', () => {
  it('shows all-clear when routing is auto_eligible', () => {
    render(<RoutingReasonsBanner routing="auto_eligible" routing_reasons={[]} overall_confidence={0.97} />);
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /why this needs review/i })).not.toBeInTheDocument();
  });

  it('shows all-clear when routing_reasons is empty regardless of routing value', () => {
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={[]} overall_confidence={null} />);
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /why this needs review/i })).not.toBeInTheDocument();
  });

  it('renders all reason messages in the flagged state', () => {
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={reasons} overall_confidence={0.64} />);
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).toBeInTheDocument();
    expect(screen.getByText('Deal value $45,000 exceeds auto-send cap $20,000')).toBeInTheDocument();
  });

  it('collapses the body on toggle and expands it again', async () => {
    const user = userEvent.setup();
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={reasons} overall_confidence={0.64} />);

    const btn = screen.getByRole('button', { name: /why this needs review/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Line confidence 0.64 below auto threshold 0.95')).not.toBeInTheDocument();

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).toBeInTheDocument();
  });

  it('shows all-clear when routing is null and reasons is empty', () => {
    render(<RoutingReasonsBanner routing={null} routing_reasons={[]} overall_confidence={null} />);
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
  });
});
