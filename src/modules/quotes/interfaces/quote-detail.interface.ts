import type { QuoteStatus } from '../enums/quote-status.enum';

/** One priced line of the suggested quote. */
export interface QuoteLineDetail {
  position: number;
  sku_id: string | null;
  description: string;
  quantity: number;
  unit_price_minor: number;
  amount_minor: number;
}

/**
 * The suggested quote with its running total, for the Review screen's quote pane (US-E6-1) and the
 * Quote Output screen (US-E6-6). One shared shape for both the pre-approval preview and the
 * just-approved response, built via `toQuoteDetail` (`src/modules/quotes/mappers/quote-detail.mapper.ts`),
 * so the two read paths can never drift into two different shapes.
 */
export interface QuoteDetail {
  quote_number: string;
  status: QuoteStatus;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  currency: string;
  lead_time_days: number | null;
  pdf_storage_url: string | null;
  pdf_generated_at: Date | null;
  email_draft_subject: string | null;
  email_draft_body: string | null;
  lines: QuoteLineDetail[];
}
