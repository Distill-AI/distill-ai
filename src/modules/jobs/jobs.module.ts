import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsQueueModule } from '@queue/jobs-queue.module';
import { QueueClientModule } from '@queue/queue-client.module';
import { Job } from './entities/job.entity';
import { JobModelAction } from './jobs.model-action';
import { JobsService } from './jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), QueueClientModule, JobsQueueModule],
  providers: [JobsService, JobModelAction],
  exports: [JobsService, JobModelAction],
})
export class JobsModule {}
