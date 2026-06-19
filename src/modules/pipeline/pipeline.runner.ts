import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';

interface PipelineJobData {
  requestId: string;
}

/** Producer side of the pipeline queue (runs in the API process). */
@Injectable()
export class PipelineRunner {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue<PipelineJobData>) {}

  /**
   * Enqueue a request for pipeline processing. Idempotent via the stable jobId
   * `pipeline:<requestId>`, so crash-recovery re-enqueues are deduplicated by Bull.
   */
  async enqueue(requestId: string): Promise<void> {
    await this.queue.add(PIPELINE_JOBS.RUN, { requestId }, { jobId: `pipeline:${requestId}` });
  }
}
