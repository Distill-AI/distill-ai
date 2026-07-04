import { Module } from '@nestjs/common';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { RequestsModule } from '@modules/requests/requests.module';
import { PipelineModule } from '@modules/pipeline/pipeline.module';
import { EventsModule } from '@modules/events/events.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

/**
 * Request intake (US-E1-1). Owns `POST /requests`. Kept separate from RequestsModule (the data
 * layer) so it can depend on PipelineModule for the runner without a circular import
 * (PipelineModule already imports RequestsModule). EventsModule is imported directly - PipelineModule
 * imports it too but does not export it, so it does not come through transitively.
 */
@Module({
  imports: [RequestsModule, PipelineModule, ObjectStoreModule, EventsModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
