import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfidenceDistributionChart } from './ConfidenceDistributionChart';

const meta: Meta<typeof ConfidenceDistributionChart> = {
  component: ConfidenceDistributionChart,
  title: 'Analytics/ConfidenceDistributionChart',
};

export default meta;
type Story = StoryObj<typeof ConfidenceDistributionChart>;

export const Balanced: Story = {
  args: { highPct: 64, mediumPct: 27, lowPct: 9 },
};

export const AllHigh: Story = {
  args: { highPct: 100, mediumPct: 0, lowPct: 0 },
};

export const Empty: Story = {
  args: { highPct: 0, mediumPct: 0, lowPct: 0 },
};
