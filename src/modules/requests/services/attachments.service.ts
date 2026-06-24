import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { QUEUES, PIPELINE_JOBS } from '@common/constants/queue.constants';
import { CurrentNode } from '../enums/current-node.enum';
import { RequestStatus } from '../enums/request-status.enum';
import { AttachmentModelAction } from '../attachments.model-action';
import { RequestModelAction } from '../requests.model-action';
import type { Attachment } from '../entities/attachment.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

/** The stored original of an attachment: its metadata plus the raw bytes from the object store. */
export interface DownloadableAttachment {
  attachment: Attachment;
  bytes: Buffer;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly attachments: AttachmentModelAction,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore,
    private readonly requests: RequestModelAction,
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
  ) {}

  /**
   * Load an attachment's original bytes for download. The attachment is looked up by `id` AND
   * `request_id`, so the caller must already have proven access to the parent request (the request
   * carries the org_id; `attachments` is not RLS-scoped). Throws a 404 if the attachment does not
   * exist under that request.
   */
  async getForDownload(requestId: string, attachmentId: string): Promise<DownloadableAttachment> {
    const attachment = await this.attachments.get({
      identifierOptions: { id: attachmentId, request_id: requestId },
    });
    if (!attachment) {
      throw new CustomHttpException(
        SYS_MSG.ATTACHMENT_NOT_FOUND(attachmentId),
        HttpStatus.NOT_FOUND,
      );
    }
    const bytes = await this.store.get(attachment.storage_url);
    return { attachment, bytes };
  }

  /**
   * Accept pasted content, update the attachment, re-checkpoint the request to EXTRACT, and
   * re-enqueue the pipeline. The engine calls markProcessing() at run-start, so no explicit
   * status update is needed here. Bull jobId deduplication is safe: completed jobs allow
   * re-add with the same jobId; only waiting/active jobs are deduplicated.
   */
  async paste(
    user: AuthUser,
    requestId: string,
    attachmentId: string,
    content: string,
  ): Promise<void> {
    const request = await this.requests.get({ identifierOptions: { id: requestId } });
    if (!request) {
      throw new CustomHttpException(SYS_MSG.REQUEST_NOT_FOUND(requestId), HttpStatus.NOT_FOUND);
    }

    if (user.orgId && request.org_id !== user.orgId) {
      throw new CustomHttpException(SYS_MSG.REQUEST_NOT_FOUND(requestId), HttpStatus.NOT_FOUND);
    }

    if (request.status === RequestStatus.PARSING) {
      throw new CustomHttpException(SYS_MSG.ATTACHMENT_PASTE_CONFLICT, HttpStatus.CONFLICT);
    }

    const attachment = await this.attachments.findByIdForRequest(attachmentId, requestId);
    if (!attachment) {
      throw new CustomHttpException(
        SYS_MSG.ATTACHMENT_NOT_FOUND(attachmentId),
        HttpStatus.NOT_FOUND,
      );
    }

    await this.attachments.markManualPaste(attachmentId, content);
    await this.requests.setCurrentNode(requestId, CurrentNode.EXTRACT);
    await this.queue.add(PIPELINE_JOBS.RUN, { requestId }, { jobId: `pipeline:${requestId}` });
  }
}
