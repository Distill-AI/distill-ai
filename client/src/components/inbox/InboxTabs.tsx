export type InboxTab = 'all' | 'needs_review' | 'ready' | 'needs_clarification';

const tabs: { id: InboxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'ready', label: 'Ready' },
  { id: 'needs_clarification', label: 'Needs clarification' },
];

interface InboxTabsProps {
  active: InboxTab;
  onChange: (tab: InboxTab) => void;
}

export function InboxTabs({ active, onChange }: InboxTabsProps) {
  return (
    <div role="tablist" aria-label="Filter requests" className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-body-text'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
