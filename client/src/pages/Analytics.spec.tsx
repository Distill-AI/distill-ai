import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Analytics } from './Analytics';
import { PageHeaderProvider } from '../context/PageHeaderContext';
import type { AnalyticsSummary } from '../api/analytics';

const { mockUseAnalyticsSummary } = vi.hoisted(() => ({
  mockUseAnalyticsSummary: vi.fn(),
}));

vi.mock('../api/analytics', () => ({
  useAnalyticsSummary: () => mockUseAnalyticsSummary(),
}));

const summary: AnalyticsSummary = {
  median_time_to_draft_seconds: 493,
  median_time_to_draft_delta_pct: 41,
  zero_edit_approval_pct: 68,
  zero_edit_approval_delta_pts: 6,
  auto_eligible_false_negative_pct: 3,
  auto_eligible_false_negative_delta_pts: 1,
  quotes_this_week: 128,
  quotes_this_week_delta: 12,
  crash_recoveries_this_month: 2,
  confidence_distribution: { high_pct: 64, medium_pct: 27, low_pct: 9 },
  quote_funnel: { ingested: 410, drafted: 372, approved: 295, sent: 268 },
};

const emptySummary: AnalyticsSummary = {
  ...summary,
  quotes_this_week: 0,
  confidence_distribution: { high_pct: 0, medium_pct: 0, low_pct: 0 },
  quote_funnel: { ingested: 0, drafted: 0, approved: 0, sent: 0 },
};

function renderAnalytics() {
  return render(
    <PageHeaderProvider>
      <Analytics />
    </PageHeaderProvider>,
  );
}

describe('Analytics', () => {
  beforeEach(() => {
    mockUseAnalyticsSummary.mockReset();
  });

  it('shows a loading state', () => {
    mockUseAnalyticsSummary.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderAnalytics();
    expect(screen.queryByText('Quotes this week')).not.toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const refetch = vi.fn();
    mockUseAnalyticsSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    renderAnalytics();
    expect(screen.getByText('Could not load analytics.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows an empty state when there is no data for the period', () => {
    mockUseAnalyticsSummary.mockReturnValue({
      data: emptySummary,
      isLoading: false,
      isError: false,
    });
    renderAnalytics();
    expect(screen.getByText('No quotes processed in this period yet.')).toBeInTheDocument();
    expect(screen.queryByText('Quotes this week')).not.toBeInTheDocument();
  });

  it('does not hide a non-zero card behind the empty state when only quotes_this_week is zero', () => {
    mockUseAnalyticsSummary.mockReturnValue({
      data: { ...summary, quotes_this_week: 0 },
      isLoading: false,
      isError: false,
    });
    renderAnalytics();
    expect(screen.queryByText('No quotes processed in this period yet.')).not.toBeInTheDocument();
    expect(screen.getByText('Crash recoveries')).toBeInTheDocument();
  });

  it('renders KPI cards and charts when data is present', () => {
    mockUseAnalyticsSummary.mockReturnValue({ data: summary, isLoading: false, isError: false });
    renderAnalytics();
    expect(screen.getByText('Median time to draft')).toBeInTheDocument();
    expect(screen.getByText('8m 13s')).toBeInTheDocument();
    expect(screen.getByText('Zero-edit approval')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.getByText('Auto-eligible false-neg')).toBeInTheDocument();
    expect(screen.getByText('Quotes this week')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('Crash recoveries')).toBeInTheDocument();
    expect(screen.getByText('Confidence distribution')).toBeInTheDocument();
    expect(screen.getByText('Quote funnel')).toBeInTheDocument();
  });

  it('does not crash when the response is missing nested fields', () => {
    const malformed = { ...summary, confidence_distribution: undefined, quote_funnel: undefined };
    mockUseAnalyticsSummary.mockReturnValue({
      data: malformed,
      isLoading: false,
      isError: false,
    });
    expect(() => renderAnalytics()).not.toThrow();
    expect(screen.getByText('No quotes processed in this period yet.')).toBeInTheDocument();
  });
});
