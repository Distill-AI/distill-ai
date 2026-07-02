import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { EventsService } from '../events.service';
import type { AuditEventModelAction } from '../audit-event.model-action';
import type { SseService } from '../../../sse/sse.service';

const SCHEMA_PATH = join(process.cwd(), 'events.schema.json');
const VALID_SCHEMA = JSON.stringify({
  $defs: {
    'request.received': {},
    'node.entered': {},
    'node.exited': {},
    'tool.invoked': {},
    'request.resumed': {},
    'stage.error': {},
    'quote.approved': {},
    'quote.ready': {},
    'request.declined': {},
    'pricing.completed': {},
    'policy.completed': {},
    'processing.complete': {},
    'request.finalized': {},
  },
});

function makeAuditEvents(): AuditEventModelAction {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    insertStageErrorOrIgnore: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditEventModelAction;
}

function makeSse(): SseService {
  return {
    emit: vi.fn(),
  } as unknown as SseService;
}

describe('EventsService', () => {
  let service: EventsService;
  let auditEvents: ReturnType<typeof makeAuditEvents>;
  let sse: ReturnType<typeof makeSse>;
  let schemaBackup: string | null = null;

  beforeAll(() => {
    schemaBackup = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf8') : null;
  });

  afterAll(() => {
    if (schemaBackup !== null) {
      writeFileSync(SCHEMA_PATH, schemaBackup, 'utf8');
    } else if (existsSync(SCHEMA_PATH)) {
      unlinkSync(SCHEMA_PATH);
    }
  });

  beforeEach(() => {
    if (schemaBackup !== null) {
      writeFileSync(SCHEMA_PATH, schemaBackup, 'utf8');
    } else if (existsSync(SCHEMA_PATH)) {
      unlinkSync(SCHEMA_PATH);
    }
    auditEvents = makeAuditEvents();
    sse = makeSse();
    service = new EventsService(auditEvents, sse);
  });

  describe('onModuleInit', () => {
    it('succeeds when events.schema.json has a $defs entry for every event in EVENT_PAYLOAD_SCHEMAS', () => {
      writeFileSync(SCHEMA_PATH, VALID_SCHEMA, 'utf8');
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('throws when events.schema.json is missing', () => {
      if (existsSync(SCHEMA_PATH)) unlinkSync(SCHEMA_PATH);
      expect(() => service.onModuleInit()).toThrow(/Failed to load events\.schema\.json/);
    });

    it('throws when a $defs entry is missing for a schema event name', () => {
      writeFileSync(SCHEMA_PATH, JSON.stringify({ $defs: { 'stage.error': {} } }), 'utf8');
      expect(() => service.onModuleInit()).toThrow(/missing \$defs entries/);
    });
  });

  describe('emit - stage.error routing', () => {
    const validParams = {
      eventName: 'stage.error' as const,
      orgId: 'org-uuid-0000-0000-0000',
      requestId: '00000000-0000-0000-0000-000000000001',
      attributes: { stage: 'parse', reason: 'unknown', escalated_to_human: true },
    };

    it('valid payload calls insertStageErrorOrIgnore and emits to SSE', async () => {
      await service.emit(validParams);
      expect(auditEvents.insertStageErrorOrIgnore).toHaveBeenCalledOnce();
      expect(sse.emit).toHaveBeenCalledWith(
        'stage.error',
        expect.objectContaining({ stage: 'parse', reason: 'unknown', escalated_to_human: true }),
      );
    });

    it('SSE payload only contains schema-defined fields (no raw extras)', async () => {
      await service.emit({
        ...validParams,
        attributes: {
          stage: 'parse',
          reason: 'unknown',
          escalated_to_human: true,
          error: 'raw stack trace',
        },
      });
      const ssePayload = (sse.emit as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(ssePayload).not.toHaveProperty('error');
      expect(ssePayload).toHaveProperty('stage', 'parse');
    });

    it('missing stage field logs warning and skips both DB and SSE', async () => {
      await service.emit({
        ...validParams,
        attributes: { reason: 'unknown' },
      });
      expect(auditEvents.insertStageErrorOrIgnore).not.toHaveBeenCalled();
      expect(sse.emit).not.toHaveBeenCalled();
    });

    it('missing request_id logs warning and skips both DB and SSE', async () => {
      await service.emit({
        ...validParams,
        requestId: null,
      });
      expect(auditEvents.insertStageErrorOrIgnore).not.toHaveBeenCalled();
      expect(sse.emit).not.toHaveBeenCalled();
    });

    it('skips DB insert when orgId is absent but still emits to SSE', async () => {
      await service.emit({
        eventName: 'stage.error',
        requestId: '00000000-0000-0000-0000-000000000001',
        attributes: { stage: 'parse', reason: 'unknown' },
      });
      expect(auditEvents.insertStageErrorOrIgnore).not.toHaveBeenCalled();
      expect(sse.emit).toHaveBeenCalledOnce();
    });

    it('DB insert failure is caught and SSE emit still completes', async () => {
      vi.mocked(auditEvents.insertStageErrorOrIgnore).mockRejectedValueOnce(new Error('DB down'));
      await expect(service.emit(validParams)).resolves.not.toThrow();
      expect(sse.emit).toHaveBeenCalledOnce();
    });
  });

  describe('emit - generic schema-validated events', () => {
    const cases: Array<{
      eventName: string;
      valid: Record<string, unknown>;
      invalid: Record<string, unknown>;
    }> = [
      {
        eventName: 'request.received',
        valid: { channel: 'email', attachment_count: 2 },
        invalid: { channel: 'email' },
      },
      {
        eventName: 'node.entered',
        valid: {
          type: 'node.entered',
          timestamp: new Date().toISOString(),
          node: 'parse',
          status: 'processing',
        },
        invalid: { type: 'node.entered', node: 'parse', status: 'processing' },
      },
      {
        eventName: 'node.exited',
        valid: {
          type: 'node.exited',
          timestamp: new Date().toISOString(),
          node: 'parse',
          status: 'success',
          duration_ms: 100,
          summary: 'Parsed email + attachments',
        },
        invalid: { node: 'parse', status: 'success' },
      },
      {
        eventName: 'tool.invoked',
        valid: {
          type: 'tool.invoked',
          timestamp: new Date().toISOString(),
          tool_name: 'search_catalog',
          status: 'success',
          attempt: 1,
          result_summary: 'Found 3 results',
        },
        invalid: { type: 'tool.invoked', status: 'success' },
      },
      {
        eventName: 'request.resumed',
        valid: { type: 'request.resumed', resumed_from_node: 'match', reason: 'crash_recovery' },
        invalid: { type: 'request.resumed', resumed_from_node: 'match' },
      },
      {
        eventName: 'quote.approved',
        valid: {},
        invalid: { unexpected: true },
      },
      {
        eventName: 'quote.ready',
        valid: {},
        invalid: { unexpected: true },
      },
      {
        eventName: 'request.declined',
        valid: { reason: 'Out of scope' },
        invalid: {},
      },
      {
        eventName: 'pricing.completed',
        valid: {
          node: 'price',
          next: 'policy',
          total_minor: 500,
          blocked: false,
          message: 'Priced',
        },
        invalid: { node: 'price', next: 'policy', blocked: false, message: 'Priced' },
      },
      {
        eventName: 'policy.completed',
        valid: {
          node: 'policy',
          next: 'score',
          breached: false,
          fail_closed: false,
          breach_count: 0,
          message: 'OK',
        },
        invalid: { node: 'policy', next: 'score', breached: false, message: 'OK' },
      },
      {
        eventName: 'processing.complete',
        valid: {
          type: 'processing.complete',
          timestamp: new Date().toISOString(),
          status: 'success',
          total_duration_ms: 1000,
        },
        invalid: { type: 'processing.complete', status: 'success' },
      },
      {
        eventName: 'request.finalized',
        valid: { status: 'priced' },
        invalid: {},
      },
    ];

    it.each(cases)(
      '$eventName: valid payload writes to DB and SSE',
      async ({ eventName, valid }) => {
        await service.emit({
          eventName,
          orgId: 'org-uuid-0000-0000-0000',
          requestId: '00000000-0000-0000-0000-000000000001',
          attributes: valid,
        });
        expect(auditEvents.create).toHaveBeenCalledOnce();
        expect(sse.emit).toHaveBeenCalledWith(eventName, expect.objectContaining(valid));
      },
    );

    it.each(cases)(
      '$eventName: invalid payload skips both DB and SSE',
      async ({ eventName, invalid }) => {
        await service.emit({
          eventName,
          orgId: 'org-uuid-0000-0000-0000',
          requestId: '00000000-0000-0000-0000-000000000001',
          attributes: invalid,
        });
        expect(auditEvents.create).not.toHaveBeenCalled();
        expect(sse.emit).not.toHaveBeenCalled();
      },
    );

    it('skips DB insert when orgId is absent but still emits to SSE', async () => {
      await service.emit({
        eventName: 'quote.approved',
        requestId: '00000000-0000-0000-0000-000000000001',
        attributes: {},
      });
      expect(auditEvents.create).not.toHaveBeenCalled();
      expect(sse.emit).toHaveBeenCalledOnce();
    });

    it('an event name with no registered schema is dropped (fail closed)', async () => {
      await service.emit({
        eventName: 'unknown.event.no.schema',
        orgId: 'org-uuid-0000-0000-0000',
        requestId: '00000000-0000-0000-0000-000000000001',
        attributes: { anything: true },
      });
      expect(auditEvents.create).not.toHaveBeenCalled();
      expect(sse.emit).not.toHaveBeenCalled();
    });
  });
});
