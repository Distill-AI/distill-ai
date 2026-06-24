import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { ParseErrorReason } from './enums/parse-error-reason.enum';
import { ParseStatus } from './enums/parse-status.enum';
import { Attachment } from './entities/attachment.entity';

/** Data-access for `attachments`. The `attachments` table is not RLS-scoped (no org_id); access is
 * gated through its parent request. Inherits create/get/find from {@link AbstractModelAction}. */
@Injectable()
export class AttachmentModelAction extends AbstractModelAction<Attachment> {
  constructor(
    @InjectRepository(Attachment)
    repository: Repository<Attachment>,
  ) {
    super(repository, Attachment);
  }

  /** Fetch one attachment scoped to its parent request (ownership guard). */
  async findByIdForRequest(attachmentId: string, requestId: string): Promise<Attachment | null> {
    return this.repository.findOne({ where: { id: attachmentId, request_id: requestId } });
  }

  /** Mark an attachment unparsed after a parse failure. */
  async markUnparsed(attachmentId: string, reason: ParseErrorReason): Promise<void> {
    await this.repository.update(
      { id: attachmentId },
      { parse_status: ParseStatus.UNPARSED, parse_error_reason: reason },
    );
  }

  /** Store pasted text and flip status to manual_paste. */
  async markManualPaste(attachmentId: string, rawText: string): Promise<void> {
    await this.repository.update(
      { id: attachmentId },
      { parse_status: ParseStatus.MANUAL_PASTE, raw_text: rawText, parse_error_reason: null },
    );
  }
}
