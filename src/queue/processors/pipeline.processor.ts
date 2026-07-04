import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job as BullJob } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import { env } from '@config/env';
import { LoggerContextService } from '@common/logger/logger-context.service';
import { runWithTraceContext, type TraceCarrier } from '@common/telemetry/telemetry';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';

type PipelineJobData = {
  requestId: string;
  reason?: string;
  skipExtract?: boolean;
} & TraceCarrier;

/**
 * Worker-process consumer for the pipeline queue. Drives the graph engine for each request.
 * Registered only in the worker (via PipelineQueueModule), never in the API process.
 */
@Processor(QUEUES.PIPELINE)
export class PipelineProcessor {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    private readonly engine: PipelineGraphEngine,
    private readonly logContext: LoggerContextService,
  ) {}

  @Process({ name: PIPELINE_JOBS.RUN, concurrency: env.PIPELINE_CONCURRENCY })
  async handle(job: BullJob<PipelineJobData>): Promise<void> {
    const { requestId, reason, skipExtract, traceparent, tracestate } = job.data;
    // Continue the trace the producer started so the worker's spans link to the API side (EC-01),
    // and seed the log context so every line this run emits carries request_id + trace_id (AC-02).
    await runWithTraceContext({ traceparent, tracestate }, () =>
      this.logContext.run({ requestId, jobId: job.id, queue: QUEUES.PIPELINE }, async () => {
        this.logger.log({ event: 'pipeline_job_received', requestId, bullJobId: job.id });
        await this.engine.run(requestId, reason, skipExtract);
      }),
    );
  }
}
