import type { ReactNode } from 'react';
import type { RequestSummary } from '../../api/requests';
import { RequestRow } from './RequestRow';

interface InboxListProps {
  requests: RequestSummary[];
  isLoading: boolean;
  isError: boolean;
  /** True when a tab filter or search query is narrowing the list, so an empty result is a no-match, not a no-data, state. */
  isFiltered?: boolean;
}

const columns = ['Company & contact', 'Subject', 'Type', 'Confidence', 'Received', 'Status'];

function StateRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

export function InboxList({ requests, isLoading, isError, isFiltered = false }: InboxListProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && requests.length === 0 ? (
            <StateRow>Loading requests…</StateRow>
          ) : isError && requests.length === 0 ? (
            <StateRow>Could not load requests. Retrying…</StateRow>
          ) : requests.length === 0 ? (
            <StateRow>
              {isFiltered ? 'No requests match the current filters.' : 'No requests yet.'}
            </StateRow>
          ) : (
            requests.map((request) => <RequestRow key={request.id} request={request} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
