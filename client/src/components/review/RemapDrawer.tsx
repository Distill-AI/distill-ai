import { useState } from 'react';
import { useCandidates, useRemapLineItem } from '../../api/lineItems';
import { useSkuSearch } from '../../api/catalog';
import { formatMoney } from '../../lib/formatMoney';

interface RemapDrawerProps {
  requestId: string;
  lineId: string;
  lineLabel: string;
  onClose: () => void;
}

interface Option {
  sku_id: string;
  sku_code: string;
  name: string;
  base_price_minor: number;
  currency: string;
  /** Ranked-candidate confidence (0-1); absent for manual-search hits. */
  confidence?: number;
}

/** A selectable SKU row, used for both ranked candidates and manual-search hits. */
function OptionRow({
  option,
  selected,
  onSelect,
}: {
  option: Option;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-card border p-3 text-left ${
        selected ? 'border-accent bg-accent/5' : 'border-border bg-canvas hover:bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-body-text">
            <span className="font-mono">{option.sku_code}</span> {option.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatMoney(option.base_price_minor, option.currency)}
          </p>
        </div>
        {option.confidence !== undefined && (
          <span className="whitespace-nowrap text-xs font-medium text-muted">
            {Math.round(option.confidence * 100)}%
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * The re-map drawer (US-E6-2). Lists ranked candidates plus a manual catalog search and confirms a
 * selection via PATCH. A line with no candidates opens straight into manual search (EC-01); a search
 * with no hits shows a no-results state (EC-02); a failed confirm surfaces the error and leaves the
 * line on server state, since the workspace only reconciles on success (EC-03).
 */
export function RemapDrawer({ requestId, lineId, lineLabel, onClose }: RemapDrawerProps) {
  const [userMode, setUserMode] = useState<'candidates' | 'search' | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const candidates = useCandidates(lineId);
  const search = useSkuSearch(query);
  const remap = useRemapLineItem(requestId);

  // EC-01: a line with no candidates defaults to manual search; the user can still switch tabs.
  // Derived (not an effect) so there is no setState-in-effect cascade.
  const noCandidates = candidates.isSuccess && candidates.data.length === 0;
  const mode = userMode ?? (noCandidates ? 'search' : 'candidates');

  const confirm = () => {
    if (!selected) return;
    remap.mutate({ lineId, payload: { sku_id: selected } }, { onSuccess: onClose });
  };

  const candidateOptions: Option[] = (candidates.data ?? []).map((c) => ({
    sku_id: c.sku_id,
    sku_code: c.sku_code,
    name: c.name,
    base_price_minor: c.base_price_minor,
    currency: c.currency,
    confidence: c.confidence,
  }));
  const searchOptions: Option[] = (search.data ?? []).map((s) => ({
    sku_id: s.sku_id,
    sku_code: s.sku_code,
    name: s.name,
    base_price_minor: s.base_price_minor,
    currency: s.currency,
  }));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Re-map line item"
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-body-text">Re-map line</h2>
            <p className="mt-0.5 truncate text-xs text-muted">{lineLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted hover:bg-canvas hover:text-body-text"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-2 border-b border-border px-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => setUserMode('candidates')}
            className={`rounded px-2 py-1 ${mode === 'candidates' ? 'bg-canvas font-medium text-body-text' : 'text-muted'}`}
          >
            Ranked candidates
          </button>
          <button
            type="button"
            onClick={() => setUserMode('search')}
            className={`rounded px-2 py-1 ${mode === 'search' ? 'bg-canvas font-medium text-body-text' : 'text-muted'}`}
          >
            Search catalog
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'candidates' ? (
            <div className="flex flex-col gap-2">
              {candidates.isLoading ? (
                <p className="text-sm text-muted">Loading candidates…</p>
              ) : candidateOptions.length === 0 ? (
                <p className="text-sm text-muted">
                  No ranked candidates. Use Search catalog to pick a SKU.
                </p>
              ) : (
                candidateOptions.map((opt) => (
                  <OptionRow
                    key={opt.sku_id}
                    option={opt}
                    selected={selected === opt.sku_id}
                    onSelect={() => setSelected(opt.sku_id)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search SKU code or name…"
                  aria-label="Search catalog"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-canvas"
                  >
                    Clear
                  </button>
                )}
              </div>
              {query.trim().length === 0 ? (
                <p className="text-sm text-muted">Type to search the catalog.</p>
              ) : search.isFetching ? (
                <p className="text-sm text-muted">Searching…</p>
              ) : searchOptions.length === 0 ? (
                // EC-02: a search with no hits shows a no-results state with a way to clear and retry.
                <p className="text-sm text-muted">
                  No SKUs match “{query}”. Try different keywords or clear the search.
                </p>
              ) : (
                searchOptions.map((opt) => (
                  <OptionRow
                    key={opt.sku_id}
                    option={opt}
                    selected={selected === opt.sku_id}
                    onSelect={() => setSelected(opt.sku_id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-border p-4">
          {remap.isError && (
            <p className="mb-2 text-sm text-rose-600">Re-map failed. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-body-text hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!selected || remap.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {remap.isPending ? 'Applying…' : 'Confirm match'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
