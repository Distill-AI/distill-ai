import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { Attachment } from './entities/attachment.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { RequestModelAction } from './requests.model-action';
import { AttachmentModelAction } from './attachments.model-action';

@Module({
  imports: [TypeOrmModule.forFeature([Request, Attachment, Organization])],
  providers: [RequestModelAction, AttachmentModelAction],
  exports: [RequestModelAction, AttachmentModelAction],
})
export class RequestsModule {}
