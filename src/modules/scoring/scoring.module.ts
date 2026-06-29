import { Module } from '@nestjs/common';
import { ScorerService } from './scorer.service';
import { ScoringConfigService } from './scoring-config.service';

@Module({
  providers: [ScorerService, ScoringConfigService],
  exports: [ScorerService, ScoringConfigService],
})
export class ScoringModule {}
