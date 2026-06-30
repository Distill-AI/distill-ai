import { useState } from 'react';
import type { LineItemDetail } from '../../api/requests';
import { ConfidenceChip } from '../ConfidenceChip';
import { RemapDrawer } from './RemapDrawer';

interface ParsedStructurePaneProps {
  requestId: string;
  lines: LineItemDetail[];
}

/** Turns a raw flag like "close_tie" into a readable marker label. */
function flagLabel(flag: string): string {
  return flag.replace(/_/g, ' ');
}

/** A visible marker for a line-item flag (close_tie, pricing_blocked, margin_floor_breach, ...). */
function FlagMarker({ flag }: { flag: string }) {
  return (
    <span className="inline-flex items-center rounded bg-lo-tx/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lo-tx">
      {flagLabel(flag)}
    </span>
  );
}

/**
 * The parsed-structure pane (US-E6-1 FR-2). Renders each extracted line with its matched SKU, a
 * per-line confidence chip, and visible flag markers. All request-derived text (raw_text, SKU
 * name) is rendered as React children, so it is escaped before display (SEC-01).
 */
export function ParsedStructurePane({ requestId, lines }: ParsedStructurePaneProps) {
  const [remapLine, setRemapLine] = useState<LineItemDetail | null>(null);

  return (
    <section aria-labelledby="parsed-structure-heading" className="flex flex-1 flex-col gap-3">
      <h2
        id="parsed-structure-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Parsed structure
      </h2>

      {lines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-card border border-dashed border-border py-10 text-sm text-muted">
          No line items parsed yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="rounded-card border border-border bg-canvas p-3"
              data-testid="parsed-line"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-body-text">{line.raw_text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {line.matched_sku ? (
                      <>
                        <span className="font-mono">{line.matched_sku.sku_code}</span>{' '}
                        {line.matched_sku.name}
                      </>
                    ) : (
                      <span className="italic">No catalog match</span>
                    )}
                  </p>
                </div>
                <ConfidenceChip value={line.match_confidence} />
              </div>

              {/* Quantity + flags only; the priced unit/amount is shown (and currency-formatted) in
                  the Suggested Quote pane, so it is not rendered here as a raw minor-unit number. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span>
                  Qty <span className="font-medium text-body-text">{line.quantity ?? '—'}</span>
                </span>
                {line.flags.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {line.flags.map((flag) => (
                      <FlagMarker key={flag} flag={flag} />
                    ))}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setRemapLine(line)}
                  className="ml-auto rounded border border-border px-2 py-0.5 text-xs font-medium text-accent hover:bg-surface"
                >
                  Re-map
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {remapLine && (
        <RemapDrawer
          key={remapLine.id}
          requestId={requestId}
          lineId={remapLine.id}
          lineLabel={remapLine.raw_text}
          onClose={() => setRemapLine(null)}
        />
      )}
    </section>
  );
}
