import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { SseModule } from '../../sse/sse.module';
import { EventsModule } from '../events/events.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { Request } from './entities/request.entity';
import { Attachment } from './entities/attachment.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { RequestModelAction } from './requests.model-action';
import { AttachmentModelAction } from './attachments.model-action';
import { RequestsService } from './services/requests.service';
import { StreamService } from './services/stream.service';
import { AttachmentsService } from './services/attachments.service';
import { RequestsController } from './controllers/requests.controller';
import { RequestActions } from './actions/request.actions';

@Module({
  imports: [
    TypeOrmModule.forFeature([Request, Attachment, Organization]),
    SseModule,
    EventsModule,
    ObjectStoreModule,
    forwardRef(() => PipelineModule),
  ],
  controllers: [RequestsController],
  providers: [
    RequestModelAction,
    AttachmentModelAction,
    AttachmentsService,
    RequestsService,
    RequestActions,
    StreamService,
  ],
  exports: [
    RequestModelAction,
    AttachmentModelAction,
    RequestsService,
    RequestActions,
    StreamService,
  ],
})
export class RequestsModule {}
