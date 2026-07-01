import type { QuoteDetail } from '../interfaces/quote-detail.interface';
import type { Quote } from '../entities/quote.entity';
import type { QuoteLineItem } from '../entities/quote-line-item.entity';

/**
 * Maps a `Quote` + its line items to the wire shape shared by the Review screen's quote pane
 * (`GET /requests/:id`) and the just-approved response (`POST /requests/:id/quote`), so the two
 * read paths can never drift into two different shapes.
 */
export function toQuoteDetail(quote: Quote, lines: QuoteLineItem[]): QuoteDetail {
  return {
    quote_number: quote.quote_number,
    status: quote.status,
    subtotal_minor: quote.subtotal_minor,
    discount_minor: quote.discount_minor,
    total_minor: quote.total_minor,
    currency: quote.currency,
    lead_time_days: quote.lead_time_days,
    pdf_storage_url: quote.pdf_storage_url,
    pdf_generated_at: quote.pdf_generated_at,
    email_draft_subject: quote.email_draft_subject,
    email_draft_body: quote.email_draft_body,
    lines: lines.map((line) => ({
      position: line.position,
      sku_id: line.sku_id,
      description: line.description,
      quantity: line.quantity,
      unit_price_minor: line.unit_price_minor,
      amount_minor: line.amount_minor,
    })),
  };
}
