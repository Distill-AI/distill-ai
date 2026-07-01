interface BlockingItemsCardProps {
  gaps: string[];
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1.5 1.5 0 0 0 3.5 20.5h17a1.5 1.5 0 0 0 1.39-2.46L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Renders each clarification gap as an amber warning row (US-E6-UI-1 / US-E6-6-FE Clarification screen). */
export function BlockingItemsCard({ gaps }: BlockingItemsCardProps) {
  return (
    <section
      aria-labelledby="blocking-items-heading"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div>
        <h2 id="blocking-items-heading" className="text-sm font-semibold text-slate-900">
          We need a few details before quoting
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {gaps.length} {gaps.length === 1 ? 'item is' : 'items are'} blocking a confident quote
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {gaps.map((gap) => (
          <li
            key={gap}
            className="flex items-start gap-2 rounded-card bg-md-bg px-3 py-2 text-sm text-md-tx"
          >
            <span className="mt-0.5 shrink-0">
              <WarningIcon />
            </span>
            {gap}
          </li>
        ))}
      </ul>
    </section>
  );
}
