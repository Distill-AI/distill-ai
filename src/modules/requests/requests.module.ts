import { Module } from '@nestjs/common';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { ExtractionModule } from '@modules/extraction/extraction.module';
import { QuotesModule } from '@modules/quotes/quotes.module';
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
    // RequestsDataModule is the leaf; re-exported below so downstream consumers of RequestsModule are unaffected.
    RequestsDataModule,
    SseModule,
    EventsModule,
    ObjectStoreModule,
    ExtractionModule,
    // QuotesModule provides QuoteModelAction so the Review detail can include the suggested quote.
    QuotesModule,
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
    AttachmentsService,
  ],
})
export class RequestsModule {}
