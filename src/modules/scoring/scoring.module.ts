import { Module } from '@nestjs/common';
import { ExtractionModule } from '@modules/extraction/extraction.module';
import { RequestsModule } from '@modules/requests/requests.module';
import { ScorerService } from './scorer.service';

@Module({
  imports: [RequestsModule, ExtractionModule],
  providers: [ScorerService],
  exports: [ScorerService],
})
export class ScoringModule {}
