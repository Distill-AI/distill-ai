import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfidenceBadge } from './ConfidenceBadge';

const meta: Meta<typeof ConfidenceBadge> = {
  component: ConfidenceBadge,
  title: 'UI/ConfidenceBadge',
};

export default meta;
type Story = StoryObj<typeof ConfidenceBadge>;

export const High: Story = {
  args: { value: 0.96 },
};

export const Medium: Story = {
  args: { value: 0.78 },
};

export const Low: Story = {
  args: { value: 0.5 },
};

export const NoData: Story = {
  args: { value: null },
};
