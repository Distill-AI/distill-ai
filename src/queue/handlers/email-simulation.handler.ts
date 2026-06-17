import { Injectable, Logger } from '@nestjs/common';
import type { SendEmailPayload } from '@modules/jobs/interfaces/job-payload.interface';
import { maskEmail } from '@common/logger/pii';

const FAILURE_RATE = 0.15;
const MIN_LATENCY_MS = 100;
const MAX_LATENCY_MS = 600;

@Injectable()
export class EmailSimulationHandler {
  private readonly logger = new Logger(EmailSimulationHandler.name);

  /** Simulates sending an email: 15% failure rate, 100–600 ms latency. */
  async handle(payload: SendEmailPayload): Promise<void> {
    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
    await new Promise((resolve) => setTimeout(resolve, latency));

    if (Math.random() < FAILURE_RATE) {
      throw new Error(`Simulated email delivery failure to ${maskEmail(payload.to)}`);
    }

    this.logger.log({
      event: 'email_sent',
      to: maskEmail(payload.to),
      subject: payload.subject,
      latencyMs: Math.round(latency),
    });
  }
}
