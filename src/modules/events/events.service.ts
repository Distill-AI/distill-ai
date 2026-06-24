import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SseService } from '../../sse/sse.service';
import { AuditEventModelAction } from './audit-event.model-action';
import { StageErrorPayloadSchema } from '@constants/events.constants';

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
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly auditEvents: AuditEventModelAction,
    private readonly sse: SseService,
  ) {}

  onModuleInit(): void {
    const schemaPath = join(process.cwd(), 'events.schema.json');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Failed to load events.schema.json: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (parsed.$id !== 'stage.error') {
      throw new Error(
        `Failed to load events.schema.json: $id must be "stage.error", got "${String(parsed.$id)}"`,
      );
    }
  }

  /** Append an audit_events row and emit the same event to the sanitized SSE stream. */
  async emit(params: EmitEventParams): Promise<void> {
    if (params.eventName === 'stage.error') {
      return this.emitStageError(params);
    }

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

  private async emitStageError(params: EmitEventParams): Promise<void> {
    const attrs = params.attributes ?? {};
    const payload: unknown = {
      event_type: 'stage.error',
      request_id: params.requestId,
      stage: attrs['stage'],
      reason: attrs['reason'],
      escalated_to_human: true,
      occurred_at: new Date().toISOString(),
    };

    const result = StageErrorPayloadSchema.safeParse(payload);
    if (!result.success) {
      this.logger.warn({
        event: 'event_emit_validation_failed',
        event_name: 'stage.error',
        errors: result.error.flatten(),
      });
      return;
    }

    if (params.orgId) {
      try {
        await this.auditEvents.insertStageErrorOrIgnore({
          org_id: params.orgId,
          request_id: params.requestId ?? null,
          event_name: 'stage.error',
          attributes: result.data as unknown as Record<string, unknown>,
        });
      } catch (err) {
        this.logger.error({
          event: 'audit_event_insert_failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.sse.emit('stage.error', result.data as unknown as Record<string, unknown>);
  }
}
