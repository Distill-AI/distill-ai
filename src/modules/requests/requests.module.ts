import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { SseModule } from '../../sse/sse.module';
import { EventsModule } from '../events/events.module';
import { QueueClientModule } from '../../queue/queue-client.module';
import { Request } from './entities/request.entity';
import { Attachment } from './entities/attachment.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { RequestModelAction } from './requests.model-action';
import { AttachmentModelAction } from './attachments.model-action';
import { RequestsService } from './services/requests.service';
import { StreamService } from './services/stream.service';
import { AttachmentsService } from './services/attachments.service';
import { RequestsController } from './controllers/requests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Request, Attachment, Organization]),
    SseModule,
    EventsModule,
    ObjectStoreModule,
    QueueClientModule,
  ],
  controllers: [RequestsController],
  providers: [
    RequestModelAction,
    AttachmentModelAction,
    RequestsService,
    StreamService,
    AttachmentsService,
  ],
  exports: [
    RequestModelAction,
    AttachmentModelAction,
    RequestsService,
    StreamService,
    AttachmentsService,
  ],
})
export class RequestsModule {}
