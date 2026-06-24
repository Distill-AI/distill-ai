import { useMemo, useRef, useState } from 'react';
import { NewRequestModal } from '../components/inbox/NewRequestModal';
import { InboxTabs, type InboxTab } from '../components/inbox/InboxTabs';
import { InboxList } from '../components/inbox/InboxList';
import { useRequests, type RequestSummary } from '../api/requests';

function matchesTab(request: RequestSummary, tab: InboxTab): boolean {
  return tab === 'all' || request.status === tab;
}

function matchesSearch(request: RequestSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [request.sender_company, request.sender_contact, request.source_subject]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function Inbox() {
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>('all');
  const [search, setSearch] = useState('');
  const newRequestButtonRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError } = useRequests();

  const visibleRequests = useMemo(() => {
    const requests = data ?? [];
    const query = search.trim();
    return requests.filter((request) => matchesTab(request, tab) && matchesSearch(request, query));
  }, [data, tab, search]);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>
        <button
          ref={newRequestButtonRef}
          type="button"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          className="h-9 px-4 rounded-button bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New request
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search requests"
          aria-label="Search requests"
          className="h-9 w-full max-w-sm rounded-button border border-border bg-surface px-3 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <InboxTabs active={tab} onChange={setTab} />
      </div>

      <InboxList requests={visibleRequests} isLoading={isLoading} isError={isError} />

      <NewRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        triggerRef={newRequestButtonRef}
      />
    </div>
  );
}
