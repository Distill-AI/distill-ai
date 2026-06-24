import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
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
import { AttachmentsService } from '../services/attachments.service';
import { PasteAttachmentDto } from '../dto/paste-attachment.dto';
import {
  RequestEventsDocs,
  DownloadAttachmentDocs,
  PasteAttachmentDocs,
} from '../docs/requests-swagger.doc';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

@Controller('requests')
export class RequestsController {
  private readonly logger = new Logger(RequestsController.name);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly streamService: StreamService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

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

  @Post(':id/attachments/:attachmentId/paste')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @PasteAttachmentDocs()
  async pasteAttachment(
    @Param('id') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() dto: PasteAttachmentDto,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string }> {
    await this.attachmentsService.paste(req.user!, requestId, attachmentId, dto.content);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.ATTACHMENT_PASTE_ACCEPTED };
  }
}
