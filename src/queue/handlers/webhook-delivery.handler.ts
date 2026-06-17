import { Injectable, Logger } from '@nestjs/common';
import type { WebhookDeliveryPayload } from '@modules/jobs/interfaces/job-payload.interface';

const FAILURE_RATE = 0.2;
const MIN_LATENCY_MS = 50;
const MAX_LATENCY_MS = 400;

@Injectable()
export class WebhookDeliveryHandler {
  private readonly logger = new Logger(WebhookDeliveryHandler.name);

  /** Simulates delivering a webhook: 20% failure rate, 50–400 ms latency. */
  async handle(payload: WebhookDeliveryPayload): Promise<void> {
    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
    await new Promise((resolve) => setTimeout(resolve, latency));

    if (Math.random() < FAILURE_RATE) {
      throw new Error(`Simulated webhook delivery failure to ${payload.url}`);
    }

    this.logger.log({
      event: 'webhook_delivered',
      url: payload.url,
      method: payload.method,
      latencyMs: Math.round(latency),
    });
  }
}
