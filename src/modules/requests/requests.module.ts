import { Module } from '@nestjs/common';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { ExtractionModule } from '@modules/extraction/extraction.module';
import { QueueClientModule } from '@queue/queue-client.module';
import { SseModule } from '../../sse/sse.module';
import { EventsModule } from '../events/events.module';
import { RequestsDataModule } from './requests-data.module';
import { RequestsService } from './services/requests.service';
import { StreamService } from './services/stream.service';
import { AttachmentsService } from './services/attachments.service';
import { RequestsController } from './controllers/requests.controller';
import { RequestActions } from './actions/request.actions';
import { NodeRecoveryActions } from './actions/node-recovery.actions';

@Module({
  imports: [
    // The request/attachment model-actions live in the leaf RequestsDataModule so
    // Extraction can depend on them without importing RequestsModule (which imports
    // ExtractionModule). Re-exported below so existing consumers are unaffected.
    RequestsDataModule,
    SseModule,
    EventsModule,
    ObjectStoreModule,
    ExtractionModule,
    QueueClientModule,
  ],
  controllers: [RequestsController],
  providers: [
    AttachmentsService,
    RequestsService,
    RequestActions,
    StreamService,
    NodeRecoveryActions,
  ],
  exports: [
    RequestsDataModule,
    RequestsService,
    RequestActions,
    StreamService,
    NodeRecoveryActions,
  ],
})
export class RequestsModule {}
