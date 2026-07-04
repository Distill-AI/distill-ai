import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { trace } from '@opentelemetry/api';
import { SseService } from '../../sse/sse.service';
import { AuditEventModelAction } from './audit-event.model-action';
import { EVENT_PAYLOAD_SCHEMAS, StageErrorPayloadSchema } from '@constants/events.constants';

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

  /**
   * Cross-checks event *names* only: every EVENT_PAYLOAD_SCHEMAS key has a $defs entry and vice
   * versa. It does not compare field-level shape, so events.schema.json and the Zod schemas can
   * still diverge on required fields or types without this check catching it; only the Zod
   * schemas are enforced against payloads at runtime, so the JSON file remains documentation-grade.
   */
  onModuleInit(): void {
    const schemaPath = join(process.cwd(), 'events.schema.json');
    let parsed: { $defs?: Record<string, unknown> };
    try {
      parsed = JSON.parse(readFileSync(schemaPath, 'utf8')) as { $defs?: Record<string, unknown> };
    } catch (err) {
      throw new Error(
        `Failed to load events.schema.json: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const definedEventNames = new Set(Object.keys(parsed.$defs ?? {}));
    const schemaEventNames = new Set(Object.keys(EVENT_PAYLOAD_SCHEMAS));
    const missing = [...schemaEventNames].filter((eventName) => !definedEventNames.has(eventName));
    if (missing.length > 0) {
      throw new Error(
        `Failed to load events.schema.json: missing $defs entries for: ${missing.join(', ')}`,
      );
    }
    const extra = [...definedEventNames].filter((eventName) => !schemaEventNames.has(eventName));
    if (extra.length > 0) {
      throw new Error(
        `Failed to load events.schema.json: $defs entries with no matching EVENT_PAYLOAD_SCHEMAS entry: ${extra.join(', ')}`,
      );
    }
  }

  /** Append an audit_events row and emit the same event to the sanitized SSE stream. */
  async emit(params: EmitEventParams): Promise<void> {
    if (params.eventName === 'stage.error') {
      return this.emitStageError(params);
    }

    const schema = EVENT_PAYLOAD_SCHEMAS[params.eventName];
    if (!schema) {
      trace.getActiveSpan()?.addEvent('event_emit_unschema_rejected', {
        event_name: params.eventName,
      });
      this.logger.error({
        event: 'event_emit_unschema_rejected',
        event_name: params.eventName,
      });
      return;
    }

    const attributes = params.attributes ?? {};
    const result = schema.safeParse(attributes);
    if (!result.success) {
      trace.getActiveSpan()?.addEvent('event_emit_validation_failed', {
        event_name: params.eventName,
      });
      this.logger.error({
        event: 'event_emit_validation_failed',
        event_name: params.eventName,
        errors: JSON.stringify(result.error.flatten()),
      });
      return;
    }

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
      trace.getActiveSpan()?.addEvent('event_emit_validation_failed', {
        event_name: 'stage.error',
      });
      this.logger.error({
        event: 'event_emit_validation_failed',
        event_name: 'stage.error',
        errors: JSON.stringify(result.error.flatten()),
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
