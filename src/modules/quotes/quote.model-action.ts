import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Quote } from './entities/quote.entity';
import { QuoteLineItem } from './entities/quote-line-item.entity';
import { QuoteStatus } from './enums/quote-status.enum';

/** One priced line to persist on a quote. All money values are minor units. */
export interface QuoteLineInput {
  skuId: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  position: number;
}

/** The full priced quote to persist for a request, replacing any prior quote for that request. */
export interface ReplaceQuoteInput {
  requestId: string;
  orgId: string;
  quoteNumber: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  leadTimeDays: number | null;
  currency: string;
  lines: QuoteLineInput[];
}

@Injectable()
export class QuoteModelAction extends AbstractModelAction<Quote> {
  constructor(
    @InjectRepository(Quote)
    repository: Repository<Quote>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(repository, Quote);
  }

  /**
   * Replaces the quote (and its line items) for a request in one unit of work, so re-running the
   * price node after a crash-resume recomputes the same quote without duplicating rows (EC-03).
   */
  async replaceForRequest(input: ReplaceQuoteInput, transaction?: EntityManager): Promise<Quote> {
    const replace = async (em: EntityManager): Promise<Quote> => {
      const existing = await em.find(Quote, { where: { request_id: input.requestId } });
      if (existing.length > 0) {
        await em.delete(QuoteLineItem, { quote_id: In(existing.map((q) => q.id)) });
        await em.delete(Quote, { request_id: input.requestId });
      }

      const quote = await em.save(Quote, {
        org_id: input.orgId,
        request_id: input.requestId,
        quote_number: input.quoteNumber,
        status: QuoteStatus.DRAFT,
        subtotal_minor: input.subtotalMinor,
        discount_minor: input.discountMinor,
        total_minor: input.totalMinor,
        currency: input.currency,
        lead_time_days: input.leadTimeDays,
      });

      if (input.lines.length > 0) {
        await em.save(
          QuoteLineItem,
          input.lines.map((l) => ({
            quote_id: quote.id,
            sku_id: l.skuId,
            description: l.description,
            quantity: l.quantity,
            unit_price_minor: l.unitPriceMinor,
            amount_minor: l.amountMinor,
            position: l.position,
          })),
        );
      }

      return quote;
    };

    if (transaction) {
      return replace(transaction);
    }
    return this.dataSource.transaction(replace);
  }

  /**
   * Removes any quote (and its line items) for a request. Used when a re-run has nothing priceable,
   * so a stale quote from an earlier run is not left attached to the request (replace-for-request
   * contract). Idempotent: a no-op when the request has no quote.
   */
  async deleteForRequest(requestId: string, transaction?: EntityManager): Promise<void> {
    const remove = async (em: EntityManager): Promise<void> => {
      const existing = await em.find(Quote, { where: { request_id: requestId } });
      if (existing.length === 0) {
        return;
      }
      await em.delete(QuoteLineItem, { quote_id: In(existing.map((q) => q.id)) });
      await em.delete(Quote, { request_id: requestId });
    };

    if (transaction) {
      await remove(transaction);
      return;
    }
    await this.dataSource.transaction(remove);
  }

  /**
   * Loads the request's quote and its line items for the Review screen (US-E6-1), or null when the
   * request has not been priced yet. Both reads run in one transaction so the quote and its lines
   * come from a single consistent snapshot, never a half-replaced quote from a concurrent recompute.
   * Lines are ordered by position so the suggested-quote pane is stable across reads.
   */
  async getForRequest(requestId: string): Promise<{ quote: Quote; lines: QuoteLineItem[] } | null> {
    return this.dataSource.transaction(async (em) => {
      const quote = await em.findOne(Quote, { where: { request_id: requestId } });
      if (!quote) {
        return null;
      }
      const lines = await em.find(QuoteLineItem, {
        where: { quote_id: quote.id },
        order: { position: 'ASC' },
      });
      return { quote, lines };
    });
  }

  /**
   * Atomically claims a `DRAFT` quote for approval. Postgres resolves any concurrent claim race at
   * the row level, so exactly one caller's update affects the row; the loser gets back `false`
   * rather than a duplicate approval.
   */
  async tryClaimForApproval(quoteId: string, approvedBy: string | null): Promise<boolean> {
    const result = await this.repository.update(
      { id: quoteId, status: QuoteStatus.DRAFT },
      { status: QuoteStatus.APPROVED, approved_by: approvedBy },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Marks a claimed quote as `READY` once its PDF has been written to object storage. Only
   * transitions from `APPROVED`, so a stale retry can't push a `DRAFT` or already-`READY` quote
   * to `READY` and overwrite its PDF metadata; returns whether the row actually transitioned.
   */
  async markReady(quoteId: string, pdfStorageUrl: string): Promise<boolean> {
    const result = await this.repository.update(
      { id: quoteId, status: QuoteStatus.APPROVED },
      { status: QuoteStatus.READY, pdf_storage_url: pdfStorageUrl, pdf_generated_at: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Compensating action for a failed render_quote_pdf call: undoes the claim so a retry can
   * re-enter at `tryClaimForApproval`. Only fires from `APPROVED`, so it can never undo a claim
   * that has already progressed past this quote's own approval attempt.
   */
  async revertToDraft(quoteId: string): Promise<void> {
    await this.repository.update(
      { id: quoteId, status: QuoteStatus.APPROVED },
      { status: QuoteStatus.DRAFT, approved_by: null },
    );
  }

  /**
   * Loads a quote and its line items by quote id, in one consistent transaction. Same shape as
   * `getForRequest`, keyed by quote id instead of request id. Uses `REPEATABLE READ` so the two
   * reads share a single snapshot: under the default `READ COMMITTED`, a concurrent
   * `replaceForRequest` between the `findOne` and `find` could otherwise return a quote paired
   * with another quote's line items.
   */
  async getByIdWithLines(
    quoteId: string,
  ): Promise<{ quote: Quote; lines: QuoteLineItem[] } | null> {
    return this.dataSource.transaction('REPEATABLE READ', async (em) => {
      const quote = await em.findOne(Quote, { where: { id: quoteId } });
      if (!quote) {
        return null;
      }
      const lines = await em.find(QuoteLineItem, {
        where: { quote_id: quote.id },
        relations: { sku: true },
        order: { position: 'ASC' },
      });
      return { quote, lines };
    });
  }
}
