import { useNavigate, Link } from 'react-router-dom';
import type { RequestSummary } from '../../api/requests';
import { requestTypeLabels } from '../../api/interface/request-status';
import { RequestStatusBadge } from '../RequestStatusBadge';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { formatRelativeTime } from '../../lib/formatRelativeTime';

/**
 * A single Inbox row. The whole row is clickable for mouse users; the company
 * name is a real Link so keyboard users can reach the Processing screen too.
 */
export function RequestRow({ request }: { request: RequestSummary }) {
  const navigate = useNavigate();
  const to = `/requests/${request.id}`;

  return (
    <tr
      onClick={() => navigate(to)}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-canvas"
    >
      <td className="px-4 py-3">
        <Link
          to={to}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-body-text hover:text-accent"
        >
          {request.sender_company ?? 'Unknown company'}
        </Link>
        <div className="text-xs text-muted">{request.sender_contact ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-sm text-body-text">{request.source_subject ?? '—'}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {requestTypeLabels[request.request_type]}
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
