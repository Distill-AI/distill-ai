import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';

interface PipelineJobData {
  requestId: string;
  reason?: string;
  skipExtract?: boolean;
}

/** Producer side of the pipeline queue (runs in the API process). */
@Injectable()
export class PipelineRunner {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue<PipelineJobData>) {}

  async enqueue(requestId: string, reason?: string, skipExtract?: boolean): Promise<void> {
    await this.queue.add(
      PIPELINE_JOBS.RUN,
      { requestId, reason, skipExtract },
      { jobId: `pipeline:${requestId}` },
    );
  }
}
