import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { EventsService } from '../events.service';
import type { AuditEventModelAction } from '../audit-event.model-action';
import type { SseService } from '../../../sse/sse.service';

const SCHEMA_PATH = join(process.cwd(), 'events.schema.json');
const VALID_SCHEMA = JSON.stringify({ $id: 'stage.error' });

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
  let originalSchema: string | null = null;

  beforeEach(() => {
    if (existsSync(SCHEMA_PATH)) {
      originalSchema = readFileSync(SCHEMA_PATH, 'utf8');
    }
    auditEvents = makeAuditEvents();
    sse = makeSse();
    service = new EventsService(auditEvents, sse);
  });

  afterEach(() => {
    if (originalSchema !== null) {
      writeFileSync(SCHEMA_PATH, originalSchema, 'utf8');
    }
  });

  describe('onModuleInit', () => {
    it('succeeds when events.schema.json exists and has $id stage.error', () => {
      writeFileSync(SCHEMA_PATH, VALID_SCHEMA, 'utf8');
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('throws when events.schema.json is missing', () => {
      if (existsSync(SCHEMA_PATH)) unlinkSync(SCHEMA_PATH);
      originalSchema = null;
      expect(() => service.onModuleInit()).toThrow(/Failed to load events\.schema\.json/);
    });

    it('throws when $id is wrong', () => {
      writeFileSync(SCHEMA_PATH, JSON.stringify({ $id: 'wrong' }), 'utf8');
      expect(() => service.onModuleInit()).toThrow(/Failed to load events\.schema\.json/);
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

  describe('emit - non-stage.error passthrough', () => {
    it('non-stage.error events use the standard audit + SSE path', async () => {
      await service.emit({
        eventName: 'tool.invoked',
        orgId: 'org-uuid-0000-0000-0000',
        requestId: '00000000-0000-0000-0000-000000000001',
        attributes: { tool: 'echo' },
      });
      expect(auditEvents.create).toHaveBeenCalledOnce();
      expect(auditEvents.insertStageErrorOrIgnore).not.toHaveBeenCalled();
      expect(sse.emit).toHaveBeenCalledWith(
        'tool.invoked',
        expect.objectContaining({ tool: 'echo' }),
      );
    });
  });
});
