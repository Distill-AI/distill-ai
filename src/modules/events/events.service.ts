import { Injectable } from '@nestjs/common';
import { SseService } from '../../sse/sse.service';
import { AuditEventModelAction } from './audit-event.model-action';

/** Parameters for a single audit event. `attributes` must be non-sensitive metadata only. */
export interface EmitEventParams {
  eventName: string;
  orgId?: string;
  requestId?: string | null;
  quoteId?: string | null;
  userId?: string | null;
  attributes?: Record<string, unknown>;
}

/**
 * Writes the durable audit trail (`audit_events`) and bridges a sanitized copy to the live SSE
 * trace. Callers pass only safe metadata (node names, tool names, statuses), never model
 * reasoning / chain-of-thought (NFR-OBS-4).
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly auditEvents: AuditEventModelAction,
    private readonly sse: SseService,
  ) {}

  /** Append an audit_events row and emit the same event to the sanitized SSE stream. */
  async emit(params: EmitEventParams): Promise<void> {
    const attributes = params.attributes ?? {};

    if (params.orgId) {
      await this.auditEvents.create({
        createPayload: {
          org_id: params.orgId,
          request_id: params.requestId ?? null,
          quote_id: params.quoteId ?? null,
          user_id: params.userId ?? null,
          event_name: params.eventName,
          attributes,
        },
        transactionOptions: { useTransaction: false },
      });
    }

    this.sse.emit(params.eventName, { request_id: params.requestId ?? null, ...attributes });
  }
}
