import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AnalyticsView } from './Analytics';
import type { AnalyticsSummary } from '../api/analytics';

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
  tool_calls_total: 847,
  confidence_distribution: { high_pct: 64, medium_pct: 27, low_pct: 9 },
  quote_funnel: { ingested: 410, drafted: 372, approved: 295, sent: 268 },
};

const emptySummary: AnalyticsSummary = {
  ...summary,
  quotes_this_week: 0,
  confidence_distribution: { high_pct: 0, medium_pct: 0, low_pct: 0 },
  quote_funnel: { ingested: 0, drafted: 0, approved: 0, sent: 0 },
};

const smallSampleSummary: AnalyticsSummary = {
  ...summary,
  quote_funnel: { ingested: 5, drafted: 4, approved: 2, sent: 1 },
};

const meta: Meta<typeof AnalyticsView> = {
  component: AnalyticsView,
  title: 'Pages/Analytics',
  args: { onRetry: fn() },
};

export default meta;
type Story = StoryObj<typeof AnalyticsView>;

export const Loading: Story = {
  args: { data: undefined, isLoading: true, isError: false },
};

export const ErrorState: Story = {
  args: { data: undefined, isLoading: false, isError: true },
};

export const Empty: Story = {
  args: { data: emptySummary, isLoading: false, isError: false },
};

export const SmallSample: Story = {
  args: { data: smallSampleSummary, isLoading: false, isError: false },
};

export const Populated: Story = {
  args: { data: summary, isLoading: false, isError: false },
};
