import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { Attachment } from './entities/attachment.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { RequestModelAction } from './requests.model-action';
import { AttachmentModelAction } from './attachments.model-action';

/**
 * Leaf data-access module for requests/attachments. It has no outward module
 * dependencies, so other modules (e.g. Extraction) can consume the request
 * model-actions without importing the full RequestsModule, which would create a
 * RequestsModule <-> ExtractionModule circular dependency.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Request, Attachment, Organization])],
  providers: [RequestModelAction, AttachmentModelAction],
  exports: [RequestModelAction, AttachmentModelAction],
})
export class RequestsDataModule {}
