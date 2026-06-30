import { useEffect, useMemo, useRef, useState } from 'react';
import { NewRequestModal } from '../components/inbox/NewRequestModal';
import { InboxTabs, type InboxTab } from '../components/inbox/InboxTabs';
import { InboxList } from '../components/inbox/InboxList';
import { useRequests, type RequestSummary } from '../api/requests';
import { usePageHeader } from '../context/PageHeaderContext';

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuestionMarkCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const { setTitle, setActions } = usePageHeader();

  const { data, isLoading, isError } = useRequests();

  useEffect(() => {
    setTitle('Inbox');
    setActions(
      <div className="flex items-center gap-2">
        <button
          ref={newRequestButtonRef}
          type="button"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          className="flex h-9 items-center gap-2 rounded-button bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New request
        </button>
        <button
          type="button"
          disabled
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-button text-body-text disabled:opacity-50"
        >
          <BellIcon />
        </button>
        <button
          type="button"
          disabled
          aria-label="Help"
          className="flex h-9 w-9 items-center justify-center rounded-button text-body-text disabled:opacity-50"
        >
          <QuestionMarkCircleIcon />
        </button>
      </div>,
    );
    return () => {
      setTitle(null);
      setActions(null);
    };
  }, [setTitle, setActions, setModalOpen]);

  const visibleRequests = useMemo(() => {
    const requests = data ?? [];
    const query = search.trim();
    return requests.filter((request) => matchesTab(request, tab) && matchesSearch(request, query));
  }, [data, tab, search]);

  // A filter is narrowing the list only when there is underlying data to narrow.
  const isFiltered = (data?.length ?? 0) > 0 && (tab !== 'all' || search.trim().length > 0);

  return (
    <div className="px-6 py-6">
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

      <InboxList
        requests={visibleRequests}
        isLoading={isLoading}
        isError={isError}
        isFiltered={isFiltered}
      />

      <NewRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        triggerRef={newRequestButtonRef}
      />
    </div>
  );
}
