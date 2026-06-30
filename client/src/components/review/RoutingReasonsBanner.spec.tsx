import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutingReasonsBanner } from './RoutingReasonsBanner';
import type { RoutingReason } from '../../api/requests';

const reasons: RoutingReason[] = [
  {
    code: 'low_line_confidence',
    message: 'Line confidence 0.64 below auto threshold 0.95',
    source: 'confidence',
  },
  {
    code: 'deal_value_cap',
    message: 'Deal value $45,000 exceeds auto-send cap $20,000',
    source: 'value',
  },
];

describe('RoutingReasonsBanner', () => {
  it('shows all-clear when routing is auto_eligible', () => {
    render(<RoutingReasonsBanner routing="auto_eligible" routing_reasons={[]} />);
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review flags/i })).not.toBeInTheDocument();
  });

  it('shows the disclosure header when routing is needs_review with no reasons', () => {
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={[]} />);
    expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review flags/i })).toBeInTheDocument();
  });

  it('renders all reason messages in the flagged state', () => {
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={reasons} />);
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).toBeInTheDocument();
    expect(
      screen.getByText('Deal value $45,000 exceeds auto-send cap $20,000'),
    ).toBeInTheDocument();
  });

  it('aria-controls points at the panel id', () => {
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={reasons} />);
    const btn = screen.getByRole('button', { name: /review flags/i });
    const panelId = btn.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeInTheDocument();
  });

  it('collapses the body on toggle and expands it again', async () => {
    const user = userEvent.setup();
    render(<RoutingReasonsBanner routing="needs_review" routing_reasons={reasons} />);

    const btn = screen.getByRole('button', { name: /review flags/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).not.toBeVisible();

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).toBeVisible();
  });

  it('renders nothing when routing is null and reasons is empty', () => {
    const { container } = render(<RoutingReasonsBanner routing={null} routing_reasons={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the disclosure with reasons when routing is null and reasons are present', () => {
    render(<RoutingReasonsBanner routing={null} routing_reasons={reasons} />);
    expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument();
    expect(screen.getByText('Line confidence 0.64 below auto threshold 0.95')).toBeInTheDocument();
  });
});
