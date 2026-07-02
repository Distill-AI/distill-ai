import type { Meta, StoryObj } from '@storybook/react-vite';
import { KpiCard } from './KpiCard';

const meta: Meta<typeof KpiCard> = {
  component: KpiCard,
  title: 'UI/KpiCard',
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Positive: Story = {
  args: { label: 'Zero-edit approval', value: '4.2%', delta: '+41%', sentiment: 'positive' },
};

export const FallingIsGood: Story = {
  name: 'Falling delta, positive sentiment',
  args: {
    label: 'Auto-eligible false-neg',
    value: '3%',
    delta: '-2pts',
    sentiment: 'positive',
  },
};

export const NoDelta: Story = {
  args: { label: 'Crash recoveries', value: '0' },
};

export const LongValue: Story = {
  render: () => (
    <div className="flex gap-4">
      <KpiCard label="Quotes this week" value="128" delta="+12" sentiment="positive" />
      <KpiCard label="Zero-edit approval" value="4.2%" delta="+6pts" sentiment="positive" />
    </div>
  ),
};
