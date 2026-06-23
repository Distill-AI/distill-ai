import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job as BullJob } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import { env } from '@config/env';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';

interface PipelineJobData {
  requestId: string;
  reason?: string;
  skipExtract?: boolean;
}

/**
 * Worker-process consumer for the pipeline queue. Drives the graph engine for each request.
 * Registered only in the worker (via PipelineQueueModule), never in the API process.
 */
@Processor(QUEUES.PIPELINE)
export class PipelineProcessor {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(private readonly engine: PipelineGraphEngine) {}

  @Process({ name: PIPELINE_JOBS.RUN, concurrency: env.PIPELINE_CONCURRENCY })
  async handle(job: BullJob<PipelineJobData>): Promise<void> {
    const { requestId, reason, skipExtract } = job.data;
    this.logger.log({ event: 'pipeline_job_received', requestId, bullJobId: job.id });
    await this.engine.run(requestId, reason, skipExtract);
  }
}
