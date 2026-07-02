import type { QuoteDetail } from './quote-detail.interface';

/**
 * Response payload for `POST /requests/:id/quote`. One key, `quote`, reusing the same `QuoteDetail`
 * `GET /requests/:id` returns, rather than a bespoke "just-approved" shape. Deliberately an envelope
 * rather than `QuoteDetail` bare: a future sibling field (e.g. `warnings`) can land without moving
 * or renaming `quote`.
 */
export interface ApproveQuoteResponsePayload {
  quote: QuoteDetail;
}
