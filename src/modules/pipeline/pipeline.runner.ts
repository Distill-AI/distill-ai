import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import { enqueueWithTrace } from '@common/telemetry/traced-enqueue';
import { type TraceCarrier } from '@common/telemetry/telemetry';

type PipelineJobData = { requestId: string; reason?: string; skipExtract?: boolean } & TraceCarrier;

/** Producer side of the pipeline queue (runs in the API process). */
@Injectable()
export class PipelineRunner {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue<PipelineJobData>) {}

  async enqueue(requestId: string, reason?: string, skipExtract?: boolean): Promise<void> {
    // Spans the enqueue and stamps trace context onto the job so the API + worker read as one trace
    // across the Bull boundary (EC-01). See enqueueWithTrace.
    await enqueueWithTrace(
      this.queue,
      PIPELINE_JOBS.RUN,
      { requestId, reason, skipExtract },
      { jobId: `pipeline:${requestId}` },
    );
  }
}
