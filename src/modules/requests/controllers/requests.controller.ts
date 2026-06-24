import {
  Controller,
  Get,
  HttpStatus,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import * as SYS_MSG from '@constants/system-messages';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { RequestActions } from '../actions/request.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import {
  RequestEventsDocs,
  RequestResumeDocs,
  DownloadAttachmentDocs,
  ListRequestsDocs,
  GetRequestDocs,
} from '../docs/requests-swagger.doc';
import { AttachmentsService } from '../services/attachments.service';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ResumeResponsePayload } from '../interfaces/resume.interface';

@Controller('requests')
export class RequestsController {
  private readonly logger = new Logger(RequestsController.name);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly streamService: StreamService,
    private readonly requestActions: RequestActions,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * List requests for the Inbox, newest first. Scoped to the caller's org when auth is enabled
   * (the @Roles guard guarantees an authenticated user in that mode); unscoped in single-tenant dev.
   */
  @Get()
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @ListRequestsDocs()
  async list(
    @Req() req: { user?: AuthUser },
    @Query('page') rawPage?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const page = Math.max(parseInt(rawPage ?? '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(rawLimit ?? '50', 10) || 50, 1), 100);
    const orgId = authConfig.enabled ? req.user?.orgId : undefined;

    const result = await this.requestsService.listForOrg({ orgId, page, limit });

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.REQUESTS_RETRIEVED,
      data: result.payload,
      ...result.paginationMeta,
    };
  }

  /**
   * Get a single request with its attachments for the Review screen. Access is gated the same way as
   * the attachment download: a missing or cross-org request returns 404 so existence is not leaked.
   */
  @Get(':id')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @GetRequestDocs()
  async getOne(@Param('id') requestId: string, @Req() req: { user?: AuthUser }) {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }

    const data = await this.requestsService.getDetail(request);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.REQUEST_RETRIEVED,
      data,
    };
  }

  /**
   * Serve the stored original bytes of an attachment (US-E1-5-T1). Access is gated through the
   * parent request: the request is loaded (404 if absent) and, when auth is enabled, its org must
   * match the caller's before any attachment is served. Uses `@Res()` so the raw bytes bypass the
   * global response-wrapping interceptor.
   */
  @Get(':id/attachments/:attachmentId')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @DownloadAttachmentDocs()
  async downloadAttachment(
    @Param('id') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: { user?: AuthUser },
    @Res() res: Response,
  ): Promise<void> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new CustomHttpException(SYS_MSG.REQUEST_NOT_FOUND(requestId), HttpStatus.NOT_FOUND);
      }
    }

    const { attachment, bytes } = await this.attachmentsService.getForDownload(
      requestId,
      attachmentId,
    );

    res.setHeader('Content-Type', attachment.mime_type);
    // Length from the actual payload, not the stored metadata, so the header can't drift from the body.
    res.setHeader('Content-Length', bytes.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    );
    res.send(bytes);
  }

  @Sse(':id/events')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @RequestEventsDocs()
  async events(
    @Param('id') requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<Observable<MessageEvent>> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
      this.logger.log({ event: SYS_MSG.STREAM_SUBSCRIBED, requestId, orgId: user.orgId });
    }

    return this.streamService.subscribe(requestId);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @RequestResumeDocs()
  async resume(
    @Param('id') requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<{
    statusCode: number;
    message: string;
    data: ResumeResponsePayload;
  }> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }

    const result = await this.requestActions.resumeRequest(request, ResumeReason.MANUAL);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.RESUME_SUCCESS,
      data: result,
    };
  }
}
