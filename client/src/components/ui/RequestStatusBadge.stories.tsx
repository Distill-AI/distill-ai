import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RequestStatus } from '../../api/interface/request-status';
import { RequestStatusBadge } from './RequestStatusBadge';

const allStatuses: RequestStatus[] = [
  'received',
  'parsing',
  'needs_review',
  'priced',
  'ready',
  'sent',
  'declined',
  'needs_clarification',
  'failed',
];

const meta: Meta<typeof RequestStatusBadge> = {
  component: RequestStatusBadge,
  title: 'UI/RequestStatusBadge',
};

export default meta;
type Story = StoryObj<typeof RequestStatusBadge>;

export const AllStatuses: Story = {
  args: { status: 'received' },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {allStatuses.map((status) => (
        <RequestStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};
