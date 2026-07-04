import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentEvidenceTile } from './AgentEvidenceTile';

const meta: Meta<typeof AgentEvidenceTile> = {
  component: AgentEvidenceTile,
  title: 'Analytics/AgentEvidenceTile',
};

export default meta;
type Story = StoryObj<typeof AgentEvidenceTile>;

export const Populated: Story = {
  args: { toolCallsTotal: 847, crashRecoveries: 3 },
};

export const ZeroRecoveries: Story = {
  args: { toolCallsTotal: 412, crashRecoveries: 0 },
};

export const AllZero: Story = {
  args: { toolCallsTotal: 0, crashRecoveries: 0 },
};
