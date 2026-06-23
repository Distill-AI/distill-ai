import { Module } from '@nestjs/common';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { RequestsModule } from '@modules/requests/requests.module';
import { PipelineModule } from '@modules/pipeline/pipeline.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

/**
 * Request intake (US-E1-1). Owns `POST /requests`. Kept separate from RequestsModule (the data
 * layer) so it can depend on PipelineModule for the runner without a circular import
 * (PipelineModule already imports RequestsModule).
 */
@Module({
  imports: [RequestsModule, PipelineModule, ObjectStoreModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
