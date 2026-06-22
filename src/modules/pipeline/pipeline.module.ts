import { Module, forwardRef } from '@nestjs/common';
import { QueueClientModule } from '@queue/queue-client.module';
import { EventsModule } from '@modules/events/events.module';
import { RequestsModule } from '@modules/requests/requests.module';
import { PipelineRunner } from './pipeline.runner';
import { RecoverySweep } from './recovery.sweep';
import { NodeRecoveryActions } from './node-recovery.actions';

/**
 * Producer side of the pipeline (API process): the runner that enqueues graph runs and the
 * recovery sweep that re-enqueues stale requests. The engine + worker processor live in
 * PipelineQueueModule (worker process only). The @Cron in RecoverySweep relies on
 * ScheduleModule.forRoot() being registered app-wide (via SchedulerModule).
 */
@Module({
  imports: [QueueClientModule, EventsModule, forwardRef(() => RequestsModule)],
  providers: [PipelineRunner, RecoverySweep, NodeRecoveryActions],
  exports: [PipelineRunner, NodeRecoveryActions],
})
export class PipelineModule {}
