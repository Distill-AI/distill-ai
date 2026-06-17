import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DlqJob } from './entities/dlq-job.entity';
import { DlqService } from './dlq.service';
import { JobsModule } from '../jobs/jobs.module';
import { SseModule } from '../../sse/sse.module';

@Module({
  imports: [TypeOrmModule.forFeature([DlqJob]), JobsModule, SseModule],
  providers: [DlqService],
  exports: [DlqService],
})
export class DlqModule {}
