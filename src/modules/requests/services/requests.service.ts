import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '@common/model-action/abstract.model-action';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { QuoteModelAction } from '@modules/quotes/quote.model-action';
import { toQuoteDetail } from '@modules/quotes/mappers/quote-detail.mapper';
import { RequestModelAction } from '../requests.model-action';
import type { Request } from '../entities/request.entity';
import { AttachmentsService } from './attachments.service';
import type {
  LineItemDetail,
  RequestDetail,
  RequestSummary,
} from '../interfaces/request-response.interface';
import * as SYS_MSG from '@constants/system-messages';

@Injectable()
export class RequestsService {
  constructor(
    private readonly modelAction: RequestModelAction,
    private readonly lineItems: LineItemModelAction,
    private readonly quotes: QuoteModelAction,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /** Finds a request by its ID, returning the entity or null if not found. */
  async findById(requestId: string): Promise<Request | null> {
    return this.modelAction.get({ identifierOptions: { id: requestId } });
  }

  /** Finds a request by its ID, throwing NotFoundException if not found. */
  async findByIdOrFail(requestId: string): Promise<Request> {
    const req = await this.findById(requestId);
    if (!req) {
      throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
    }
    return req;
  }

  /** Lists requests newest-first (id DESC tie-breaker), scoped to orgId when set; returns all when orgId is undefined. */
  async listForOrg(options: {
    orgId?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<RequestSummary>> {
    const result = await this.modelAction.list({
      filterRecordOptions: options.orgId ? { org_id: options.orgId } : undefined,
      paginationPayload: { page: options.page, limit: options.limit },
      // id DESC is a unique tie-breaker so page boundaries stay stable when created_at collides.
      order: { created_at: 'DESC', id: 'DESC' },
    });
    return { payload: result.payload.map(toRequestSummary), paginationMeta: result.paginationMeta };
  }

  /**
   * Builds the Review-screen detail for an already-loaded request: its attachments, the parsed line
   * items, and the suggested quote (US-E6-1). The quote is null until the request has been priced.
   */
  async getDetail(request: Request): Promise<RequestDetail> {
    const [attachments, lineRows, quoteRows] = await Promise.all([
      this.attachmentsService.listForRequest(request.id),
      this.lineItems.list({
        filterRecordOptions: { request_id: request.id },
        relations: { matched_sku: true },
        order: { position: 'ASC' },
      }),
      this.quotes.getForRequest(request.id),
    ]);

    return {
      ...toRequestSummary(request),
      sender_email: request.sender_email,
      source_body: request.source_body,
      current_node: request.current_node,
      routing: request.routing,
      routing_reasons: request.routing_reasons ?? [],
      attachments,
      line_items: lineRows.payload.map(toLineItemDetail),
      quote: quoteRows ? toQuoteDetail(quoteRows.quote, quoteRows.lines) : null,
    };
  }
}

/** Maps a line item entity to the parsed-structure read model (only the catalog fields the UI shows). */
function toLineItemDetail(line: LineItem): LineItemDetail {
  return {
    id: line.id,
    position: line.position,
    raw_text: line.raw_text,
    quantity: line.quantity,
    unit_price_minor: line.unit_price_minor,
    match_confidence: line.match_confidence,
    matched_sku: line.matched_sku
      ? {
          id: line.matched_sku.id,
          sku_code: line.matched_sku.sku_code,
          name: line.matched_sku.name,
        }
      : null,
    flags: Array.isArray(line.flags) ? (line.flags as string[]) : [],
  };
}

/** Maps a request entity to the Inbox list read model. */
function toRequestSummary(request: Request): RequestSummary {
  return {
    id: request.id,
    sender_company: request.sender_company,
    sender_contact: request.sender_contact,
    source_subject: request.source_subject,
    request_type: request.request_type,
    overall_confidence: request.overall_confidence,
    status: request.status,
    created_at: request.created_at,
  };
}
