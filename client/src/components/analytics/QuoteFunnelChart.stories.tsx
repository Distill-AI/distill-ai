import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuoteFunnelChart } from './QuoteFunnelChart';

const meta: Meta<typeof QuoteFunnelChart> = {
  component: QuoteFunnelChart,
  title: 'Analytics/QuoteFunnelChart',
};

export default meta;
type Story = StoryObj<typeof QuoteFunnelChart>;

export const FourStage: Story = {
  args: {
    stages: [
      { label: 'Ingested', value: 410 },
      { label: 'Drafted', value: 372 },
      { label: 'Approved', value: 295 },
      { label: 'Sent', value: 268 },
    ],
  },
};

export const NoDropoff: Story = {
  args: {
    stages: [
      { label: 'Ingested', value: 250 },
      { label: 'Drafted', value: 250 },
      { label: 'Approved', value: 250 },
      { label: 'Sent', value: 250 },
    ],
  },
};

export const Empty: Story = {
  args: { stages: [] },
};
