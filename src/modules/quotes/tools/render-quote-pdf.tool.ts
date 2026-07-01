import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { ToolContract } from '@modules/tools/interfaces/tool-contract.interface';
import { QuoteModelAction } from '../quote.model-action';
import { QuotePdfRenderer } from '../services/quote-pdf-renderer.service';

export const RenderQuotePdfInputSchema = z.object({
  quoteId: z.string().uuid(),
  orgId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
});
export const RenderQuotePdfOutputSchema = z.object({
  storageUrl: z.string().min(1),
  bytesWritten: z.number().int().positive(),
});

export type RenderQuotePdfInput = z.infer<typeof RenderQuotePdfInputSchema>;
export type RenderQuotePdfOutput = z.infer<typeof RenderQuotePdfOutputSchema>;

@Injectable()
export class RenderQuotePdfToolFactory {
  constructor(
    private readonly quotes: QuoteModelAction,
    private readonly requests: RequestModelAction,
    private readonly renderer: QuotePdfRenderer,
    @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
  ) {}

  create(): ToolContract<typeof RenderQuotePdfInputSchema, typeof RenderQuotePdfOutputSchema> {
    return {
      toolName: 'render_quote_pdf',
      description: 'Templates a priced quote into a PDF and writes it to object storage.',
      inputSchema: RenderQuotePdfInputSchema,
      outputSchema: RenderQuotePdfOutputSchema,
      execute: (input: RenderQuotePdfInput): Promise<RenderQuotePdfOutput> => this.execute(input),
    };
  }

  private async execute(input: RenderQuotePdfInput): Promise<RenderQuotePdfOutput> {
    const found = await this.quotes.getByIdWithLines(input.quoteId);
    if (!found || found.quote.org_id !== input.orgId) {
      throw new CustomHttpException(SYS_MSG.QUOTE_NOT_FOUND(input.quoteId), HttpStatus.NOT_FOUND);
    }
    const request = await this.requests.get({ identifierOptions: { id: found.quote.request_id } });
    if (!request) {
      throw new CustomHttpException(
        SYS_MSG.REQUEST_NOT_FOUND(found.quote.request_id),
        HttpStatus.NOT_FOUND,
      );
    }

    const bytes = await this.renderer.render({
      quoteNumber: found.quote.quote_number,
      issuedDate: found.quote.created_at,
      senderCompany: request.sender_company,
      senderContact: request.sender_contact,
      senderEmail: request.sender_email,
      lines: found.lines.map((line) => ({
        sku: line.sku?.sku_code ?? null,
        description: line.description,
        quantity: line.quantity,
        unitPriceMinor: line.unit_price_minor,
        amountMinor: line.amount_minor,
      })),
      subtotalMinor: found.quote.subtotal_minor,
      discountMinor: found.quote.discount_minor,
      totalMinor: found.quote.total_minor,
      currency: found.quote.currency,
      leadTimeDays: found.quote.lead_time_days,
      terms: found.quote.terms,
      validUntil: found.quote.valid_until,
    });

    // Deterministic key from the quote id and idempotency key (not a random uuid): a retry with the
    // same key overwrites the same object instead of creating a second artifact (FR-1, EC-01), while
    // the quote id keeps two different quotes from colliding if a caller ever reuses a key.
    const key = `quotes/${found.quote.org_id}/${found.quote.id}/${input.idempotencyKey}.pdf`;
    const storageUrl = await this.objectStore.put(key, bytes);
    return { storageUrl, bytesWritten: bytes.length };
  }
}
