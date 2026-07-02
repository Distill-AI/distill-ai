import { DistillMark } from '../shell/DistillMark';
import { formatMoney } from '../../lib/formatMoney';
import type { QuoteDetail } from '../../api/requests';

interface QuoteDocumentPanelProps {
  quote: QuoteDetail;
  senderCompany: string | null;
  senderContact: string | null;
  senderEmail: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * PDF-style quote document: header, Bill To, line items, and a totals footer that stays visible
 * (EC-03) while the line-items table scrolls independently.
 */
export function QuoteDocumentPanel({
  quote,
  senderCompany,
  senderContact,
  senderEmail,
}: QuoteDocumentPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-card border border-border bg-surface">
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <DistillMark size={24} color="#4F46E5" />
            <span className="text-base font-semibold text-slate-900">Distill.ai</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
              Quote {quote.quote_number}
            </p>
            {/* Quotes don't carry their own created-at timestamp in this read model; only the PDF
                generation time is known, and only once approved. */}
            {quote.pdf_generated_at && (
              <p className="mt-0.5 text-xs text-muted">
                Generated {formatDate(quote.pdf_generated_at)}
              </p>
            )}
          </div>
        </div>

        {(senderCompany || senderContact || senderEmail) && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill To</p>
            <div className="mt-1 text-sm text-body-text">
              {senderCompany && <p className="font-medium text-slate-900">{senderCompany}</p>}
              {senderContact && <p>{senderContact}</p>}
              {senderEmail && <p>{senderEmail}</p>}
            </div>
          </div>
        )}

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="pb-2">
                Item Description
              </th>
              <th scope="col" className="pb-2 text-right">
                Qty
              </th>
              <th scope="col" className="pb-2 text-right">
                Unit Price
              </th>
              <th scope="col" className="pb-2 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.position} className="border-b border-border/60">
                <td className="py-2 pr-2 text-body-text">{line.description}</td>
                <td className="py-2 text-right text-body-text">{line.quantity}</td>
                <td className="py-2 text-right text-body-text">
                  {formatMoney(line.unit_price_minor, quote.currency)}
                </td>
                <td className="py-2 text-right font-medium text-slate-900">
                  {formatMoney(line.amount_minor, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {quote.lead_time_days !== null && (
          <p className="mt-4 text-xs text-muted">
            Lead time: {quote.lead_time_days} business days.
          </p>
        )}
      </div>

      <dl className="sticky bottom-0 border-t border-border bg-surface p-4 text-sm">
        <div className="flex justify-between py-0.5 text-muted">
          <dt>Subtotal</dt>
          <dd>{formatMoney(quote.subtotal_minor, quote.currency)}</dd>
        </div>
        {quote.discount_minor > 0 && (
          <div className="flex justify-between py-0.5 text-muted">
            <dt>Discount</dt>
            <dd>-{formatMoney(quote.discount_minor, quote.currency)}</dd>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-slate-900">
          <dt>Total ({quote.currency})</dt>
          <dd data-testid="quote-document-total">
            {formatMoney(quote.total_minor, quote.currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
