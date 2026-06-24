import type { RequestStatus } from '../api/interface/request-status';
import { requestStatusLabels } from '../api/interface/request-status';

// Badge palette per status. Confidence tokens (hi/md/lo) are sacred and never
// reused here; status uses the dedicated parse/sent tokens plus the standard
// Tailwind palette to match the Figma "Updated Status V1" frame.
const colours: Record<RequestStatus, string> = {
  received: 'bg-sent-bg text-sent-tx',
  parsing: 'bg-parse-bg text-parse-tx',
  needs_review: 'bg-amber-100 text-amber-800',
  priced: 'bg-violet-100 text-violet-700',
  ready: 'bg-green-100 text-green-700',
  sent: 'bg-sent-bg text-sent-tx',
  declined: 'bg-rose-100 text-rose-700',
  needs_clarification: 'bg-sky-100 text-sky-700',
  failed: 'bg-red-100 text-red-700',
};

function WarningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.25a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0V6.5A.75.75 0 0 0 8 5.75Zm0 5a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z" />
    </svg>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colours[status]}`}
    >
      {status === 'parsing' && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-parse-tx animate-pulse" />
      )}
      {status === 'needs_clarification' && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
      )}
      {status === 'failed' && <WarningIcon />}
      {requestStatusLabels[status]}
    </span>
  );
}
