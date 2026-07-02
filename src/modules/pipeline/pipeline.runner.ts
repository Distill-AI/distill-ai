import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import {
  ATTR_REQUEST_ID,
  injectTraceContext,
  withSpan,
  type TraceCarrier,
} from '@common/telemetry/telemetry';

type PipelineJobData = { requestId: string; reason?: string; skipExtract?: boolean } & TraceCarrier;

/** Producer side of the pipeline queue (runs in the API process). */
@Injectable()
export class PipelineRunner {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue<PipelineJobData>) {}

  async enqueue(requestId: string, reason?: string, skipExtract?: boolean): Promise<void> {
    // Wrap the enqueue in a span and stamp its trace context onto the job, so the worker's run links
    // back to this point and the API + worker read as one trace across the Bull boundary (EC-01).
    await withSpan('pipeline.enqueue', { [ATTR_REQUEST_ID]: requestId }, async () => {
      await this.queue.add(
        PIPELINE_JOBS.RUN,
        { requestId, reason, skipExtract, ...injectTraceContext() },
        { jobId: `pipeline:${requestId}` },
      );
    });
  }
}
