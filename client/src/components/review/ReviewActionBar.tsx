import { useState } from 'react';
import { useDeclineRequest } from '../../api/requests';
import type { RequestStatus } from '../../api/interface/request-status';
import { requestStatusLabels } from '../../api/interface/request-status';

interface ReviewActionBarProps {
  requestId: string;
  status: string;
}

const DECLINE_REASONS = [
  'Not a relevant request',
  'Insufficient information',
  'Customer not qualified',
  'Duplicate request',
  'Other',
];

export function ReviewActionBar({ requestId, status }: ReviewActionBarProps) {
  const [showDeclinePicker, setShowDeclinePicker] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const declineMutation = useDeclineRequest();

  if (status === 'declined') {
    return (
      <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        This request has been declined.
      </div>
    );
  }

  const handleDecline = () => {
    const reason = declineReason === 'Other' ? customReason : declineReason;
    if (!reason.trim()) return;
    declineMutation.mutate({ requestId, reason: reason.trim() });
  };

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-body-text">
          {requestStatusLabels[status as RequestStatus] ?? status}
        </span>
        {!showDeclinePicker ? (
          <button
            type="button"
            onClick={() => setShowDeclinePicker(true)}
            className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Decline
          </button>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-3">
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                aria-label="Decline reason"
              >
                <option value="">Select a reason…</option>
                {DECLINE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {declineReason === 'Other' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe the reason…"
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  aria-label="Custom decline reason"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={
                    !declineReason ||
                    (declineReason === 'Other' && !customReason.trim()) ||
                    declineMutation.isPending
                  }
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {declineMutation.isPending ? 'Declining…' : 'Confirm decline'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeclinePicker(false);
                    setDeclineReason('');
                    setCustomReason('');
                  }}
                  className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-body-text hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
            {declineMutation.isError && (
              <p className="text-sm text-rose-600">
                Failed to decline. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
