import { WarningIcon } from '../ui/WarningIcon';

interface BlockingItemsCardProps {
  gaps: string[];
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
