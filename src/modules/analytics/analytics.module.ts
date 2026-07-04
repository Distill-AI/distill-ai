import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/** Read-only KPI summary for the Analytics dashboard (US-E7-2-BE). Aggregates over the shared
 * TypeORM DataSource; no entities of its own. */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
