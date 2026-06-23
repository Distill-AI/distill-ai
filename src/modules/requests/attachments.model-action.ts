import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
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
}
