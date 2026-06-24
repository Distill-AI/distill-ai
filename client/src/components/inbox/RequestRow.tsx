import { useNavigate, Link } from 'react-router-dom';
import type { RequestSummary } from '../../api/requests';
import {
  requestStatusLabels,
  requestTypeLabels,
  isRequestType,
} from '../../api/interface/request-status';
import { RequestStatusBadge } from '../ui/RequestStatusBadge';
import { ConfidenceBadge } from '../ui/ConfidenceBadge';
import { formatRelativeTime } from '../../lib/formatRelativeTime';

interface RequestRowProps {
  request: RequestSummary;
}

/**
 * A single Inbox row. The whole row is clickable for mouse users and operable
 * with Enter/Space for keyboard users; the company name is also a real Link.
 */
export function RequestRow({ request }: RequestRowProps) {
  const navigate = useNavigate();
  const to = `/requests/${request.id}`;
  const company = request.sender_company ?? 'Unknown company';
  const requestType = isRequestType(request.request_type) ? request.request_type : 'unknown';

  return (
    <tr
      onClick={() => navigate(to)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(to);
        }
      }}
      tabIndex={0}
      aria-label={`Open request from ${company}, status ${requestStatusLabels[request.status]}`}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-canvas focus:outline-none focus-visible:bg-canvas"
    >
      <td className="px-4 py-3">
        <Link
          to={to}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-body-text hover:text-accent"
        >
          {company}
        </Link>
        <div className="text-xs text-muted">{request.sender_contact ?? '-'}</div>
      </td>
      <td className="px-4 py-3 text-sm text-body-text">{request.source_subject ?? '-'}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {requestTypeLabels[requestType]}
        </span>
      </td>
      <td className="px-4 py-3">
        <ConfidenceBadge value={request.overall_confidence} />
      </td>
      <td className="px-4 py-3 text-sm text-muted">{formatRelativeTime(request.created_at)}</td>
      <td className="px-4 py-3">
        <RequestStatusBadge status={request.status} />
      </td>
    </tr>
  );
}
