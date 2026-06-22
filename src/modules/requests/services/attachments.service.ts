import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { AttachmentModelAction } from '../attachments.model-action';
import type { Attachment } from '../entities/attachment.entity';

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
  ) {}

  /**
   * Load an attachment's original bytes for download. The attachment is looked up by `id` AND
   * `request_id`, so the caller must already have proven access to the parent request (the request
   * carries the org_id; `attachments` is not RLS-scoped). Throws NotFoundException if the attachment
   * does not exist under that request.
   */
  async getForDownload(requestId: string, attachmentId: string): Promise<DownloadableAttachment> {
    const attachment = await this.attachments.get({
      identifierOptions: { id: attachmentId, request_id: requestId },
    });
    if (!attachment) {
      throw new NotFoundException(SYS_MSG.ATTACHMENT_NOT_FOUND(attachmentId));
    }
    const bytes = await this.store.get(attachment.storage_url);
    return { attachment, bytes };
  }
}
