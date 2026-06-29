import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '@common/model-action/abstract.model-action';
import { RequestModelAction } from '../requests.model-action';
import type { Request } from '../entities/request.entity';
import { AttachmentsService } from './attachments.service';
import type { RequestDetail, RequestSummary } from '../interfaces/request-response.interface';
import * as SYS_MSG from '@constants/system-messages';

@Injectable()
export class RequestsService {
  constructor(
    private readonly modelAction: RequestModelAction,
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

  /** Builds the Review-screen detail for an already-loaded request, including its attachments. */
  async getDetail(request: Request): Promise<RequestDetail> {
    const attachments = await this.attachmentsService.listForRequest(request.id);
    return {
      ...toRequestSummary(request),
      sender_email: request.sender_email,
      source_body: request.source_body,
      current_node: request.current_node,
      routing: request.routing,
      routing_reasons: request.routing_reasons ?? [],
      attachments,
    };
  }
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
