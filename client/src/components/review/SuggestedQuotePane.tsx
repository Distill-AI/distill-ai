import type { QuoteDetail } from '../../api/requests';
import { formatMoney } from '../../lib/formatMoney';

interface SuggestedQuotePaneProps {
  quote: QuoteDetail | null;
}

/**
 * The suggested-quote pane (US-E6-1 FR-1). Renders each priced line and the running total. When the
 * request has not been priced yet the pane shows a defined partial state rather than an empty box
 * (EC-01). All descriptions come from the server read model and are escaped on render (SEC-01).
 */
export function SuggestedQuotePane({ quote }: SuggestedQuotePaneProps) {
  return (
    <section aria-labelledby="suggested-quote-heading" className="flex flex-1 flex-col gap-3">
      <h2
        id="suggested-quote-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Suggested quote
      </h2>

      {!quote ? (
        <div className="flex flex-1 items-center justify-center rounded-card border border-dashed border-border py-10 text-center text-sm text-muted">
          Not priced yet. The quote appears once pricing completes.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {quote.lines.map((line) => (
              <li
                key={line.position}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-canvas p-3"
                data-testid="quote-line"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-body-text">{line.description}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {line.quantity} &times; {formatMoney(line.unit_price_minor, quote.currency)}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-body-text">
                  {formatMoney(line.amount_minor, quote.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="rounded-card border border-border bg-surface p-3 text-sm">
            <div className="flex justify-between py-0.5 text-muted">
              <dt>Subtotal</dt>
              <dd>{formatMoney(quote.subtotal_minor, quote.currency)}</dd>
            </div>
            <div className="flex justify-between py-0.5 text-muted">
              <dt>Discount</dt>
              <dd>-{formatMoney(quote.discount_minor, quote.currency)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-body-text">
              <dt>Total</dt>
              <dd data-testid="quote-total">{formatMoney(quote.total_minor, quote.currency)}</dd>
            </div>
            {quote.lead_time_days !== null && (
              <div className="mt-1 flex justify-between py-0.5 text-xs text-muted">
                <dt>Lead time</dt>
                <dd>{quote.lead_time_days} days</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}
