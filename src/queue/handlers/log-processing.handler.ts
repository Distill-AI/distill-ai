import { Injectable, Logger } from '@nestjs/common';
import type { LogProcessingPayload } from '@modules/jobs/interfaces/job-payload.interface';

const FAILURE_RATE = 0.1;
const MIN_LATENCY_MS = 20;
const MAX_LATENCY_MS = 200;

@Injectable()
export class LogProcessingHandler {
  private readonly logger = new Logger(LogProcessingHandler.name);

  /** Simulates processing a log entry: 10% failure rate, 20–200 ms latency. */
  async handle(payload: LogProcessingPayload): Promise<void> {
    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
    await new Promise((resolve) => setTimeout(resolve, latency));

    if (Math.random() < FAILURE_RATE) {
      throw new Error(`Simulated log processing failure for source: ${payload.source}`);
    }

    this.logger.log({
      event: 'log_processed',
      source: payload.source,
      level: payload.level,
      latencyMs: Math.round(latency),
    });
  }
}
