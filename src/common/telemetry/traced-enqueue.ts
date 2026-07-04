import type { JobOptions, Queue } from 'bull';
import { ATTR_REQUEST_ID, injectTraceContext, withSpan, type TraceCarrier } from './telemetry';

/**
 * Adds a job to a Bull queue inside a `pipeline.enqueue` span and stamps the current trace context onto
 * the job payload, so the worker's run links back to the producer and the API + worker read as one
 * trace across the Bull boundary (EC-01). Shared by every pipeline producer so the enqueue sites cannot
 * drift in how they span or propagate trace context.
 */
export async function enqueueWithTrace<T extends { requestId: string }>(
  queue: Queue<T & TraceCarrier>,
  jobName: string,
  data: T,
  opts?: JobOptions,
): Promise<void> {
  await withSpan('pipeline.enqueue', { [ATTR_REQUEST_ID]: data.requestId }, async () => {
    await queue.add(jobName, { ...data, ...injectTraceContext() } as T & TraceCarrier, opts);
  });
}
