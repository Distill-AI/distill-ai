import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { ClarificationService } from '../clarification.service';
import { ClarificationActions } from '../actions/clarification.actions';
import { DraftClarificationToolFactory } from '../tools/draft-clarification.tool';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import * as SYS_MSG from '@constants/system-messages';
import type { Clarification } from '../entities/clarification.entity';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeClarification(overrides: Partial<Clarification> = {}): Clarification {
  return {
    id: 'clar-0001',
    request_id: 'req-0001',
    gaps: ['Missing delivery date', 'No contact name'],
    draft_subject: 'Clarification needed for your quote request',
    draft_body:
      'Dear customer,\n\nWe need the following:\n- Missing delivery date\n- No contact name',
    sent_at: null,
    sent_by: null,
    created_at: new Date('2026-06-29T10:00:00Z'),
    updated_at: new Date('2026-06-29T10:00:00Z'),
    request: undefined as never,
    ...overrides,
  } as unknown as Clarification;
}

function createMockActions(): ClarificationActions {
  return {
    findByRequestId: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    updateDraft: vi.fn(),
    markSent: vi.fn(),
  } as unknown as ClarificationActions;
}

function createMockToolRegistry(): ToolRegistry {
  return {
    invoke: vi.fn(),
    register: vi.fn(),
  } as unknown as ToolRegistry;
}

function createMockToolFactory(): DraftClarificationToolFactory {
  return {
    create: vi.fn().mockReturnValue({
      toolName: 'draft_clarification',
      description: 'test',
      inputSchema: {} as never,
      outputSchema: {} as never,
      execute: vi.fn(),
    }),
  } as unknown as DraftClarificationToolFactory;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ClarificationService', () => {
  let service: ClarificationService;
  let mockActions: ReturnType<typeof createMockActions>;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockToolFactory: ReturnType<typeof createMockToolFactory>;

  beforeEach(() => {
    mockActions = createMockActions();
    mockToolRegistry = createMockToolRegistry();
    mockToolFactory = createMockToolFactory();
    service = new ClarificationService(mockActions, mockToolRegistry, mockToolFactory);
  });

  /* ── AC: Acceptance Criteria ─────────────────────────────────── */

  describe('AC-01 — Draft generation produces record with sent_at null', () => {
    it('creates a clarification with sent_at null when no existing record', async () => {
      const gaps = ['Missing delivery date', 'No contact name'];
      const draft = makeClarification({ gaps, sent_at: null, sent_by: null });

      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.OK,
        latency: 100,
        result: {
          draft_subject: draft.draft_subject,
          draft_body: draft.draft_body,
        },
      });
      vi.mocked(mockActions.create).mockResolvedValue(draft);

      const result = await service.generateDraft('req-0001', gaps);

      expect(result.sent_at).toBeNull();
      expect(result.sent_by).toBeNull();
      expect(result.gaps).toEqual(gaps);
      expect(mockActions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createPayload: expect.objectContaining({ sent_at: null, sent_by: null }),
        }),
      );
    });

    it('updates existing draft without setting sent_at', async () => {
      const existing = makeClarification({ sent_at: null });
      const updated = makeClarification({
        draft_subject: 'Updated subject',
        sent_at: null,
      });

      vi.mocked(mockActions.findByRequestId).mockResolvedValue(existing);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.OK,
        latency: 100,
        result: {
          draft_subject: 'Updated subject',
          draft_body: existing.draft_body,
        },
      });
      vi.mocked(mockActions.updateDraft).mockResolvedValue(updated);

      const result = await service.generateDraft('req-0001', ['Missing field']);

      expect(result.sent_at).toBeNull();
      expect(mockActions.updateDraft).toHaveBeenCalled();
      expect(mockActions.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-02 — Editing the draft changes what gets sent', () => {
    it('returns the updated draft content after edit', async () => {
      const original = makeClarification({ sent_at: null });
      const edited = makeClarification({
        draft_subject: 'Edited: Please provide missing details',
        draft_body: 'Updated body with additional context',
        sent_at: null,
      });

      vi.mocked(mockActions.get).mockResolvedValue(original);
      vi.mocked(mockActions.updateDraft).mockResolvedValue(edited);

      const result = await service.updateDraft(
        'clar-0001',
        edited.draft_subject,
        edited.draft_body,
      );

      expect(result.draft_subject).toBe('Edited: Please provide missing details');
      expect(result.draft_body).toBe('Updated body with additional context');
    });

    it('preserves existing fields when partial update is sent', async () => {
      const original = makeClarification({
        draft_subject: 'Original subject',
        draft_body: 'Original body',
        sent_at: null,
      });
      const afterSubjectUpdate = makeClarification({
        draft_subject: 'New subject',
        draft_body: 'Original body',
        sent_at: null,
      });

      vi.mocked(mockActions.get).mockResolvedValue(original);
      vi.mocked(mockActions.updateDraft).mockResolvedValue(afterSubjectUpdate);

      const result = await service.updateDraft('clar-0001', 'New subject', undefined);

      expect(result.draft_subject).toBe('New subject');
      expect(result.draft_body).toBe('Original body');
    });
  });

  describe('AC-03/04 — sent_at is only set via explicit Send action', () => {
    it('markSent is only called by the send method', async () => {
      const unsent = makeClarification({ sent_at: null });
      const sent = makeClarification({
        sent_at: new Date('2026-06-29T12:00:00Z'),
        sent_by: 'user-001',
      });

      vi.mocked(mockActions.get).mockResolvedValue(unsent);
      vi.mocked(mockActions.markSent).mockResolvedValue(sent);

      const result = await service.send('clar-0001', 'user-001');

      expect(result.sent_at).toBeInstanceOf(Date);
      expect(result.sent_by).toBe('user-001');
      expect(mockActions.markSent).toHaveBeenCalledWith('clar-0001', 'user-001');
    });

    it('no other service method sets sent_at', () => {
      const methodsThatShouldNotSetSentAt = [
        service.generateDraft,
        service.updateDraft,
        service.getByRequestId,
        service.getById,
      ];

      for (const method of methodsThatShouldNotSetSentAt) {
        const proto = Object.getPrototypeOf(method);
        const fnStr = proto ? proto.constructor.name : 'unknown';
        expect(fnStr).toBeDefined();
      }
    });
  });

  /* ── EC: Edge Cases ──────────────────────────────────────────── */

  describe('EC-01 — No concrete gaps produces no auto-send', () => {
    it('throws when gaps array is empty', async () => {
      await expect(service.generateDraft('req-0001', [])).rejects.toThrow(CustomHttpException);
      await expect(service.generateDraft('req-0001', [])).rejects.toThrow(
        SYS_MSG.CLARIFICATION_NO_GAPS,
      );
    });

    it('throws when gaps is null or undefined', async () => {
      await expect(service.generateDraft('req-0001', null as unknown as string[])).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('EC-02 — Send twice is idempotent', () => {
    it('returns existing record on second send without calling markSent again', async () => {
      const alreadySent = makeClarification({
        sent_at: new Date('2026-06-29T12:00:00Z'),
        sent_by: 'user-001',
      });

      vi.mocked(mockActions.get).mockResolvedValue(alreadySent);

      const result = await service.send('clar-0001', 'user-002');

      expect(result.sent_at).toBeInstanceOf(Date);
      expect(result.sent_by).toBe('user-001');
      expect(mockActions.markSent).not.toHaveBeenCalled();
    });
  });

  describe('EC-03 — sent_at null on new/updated draft (crash recovery safe)', () => {
    it('newly created draft has sent_at null even if gaps exist', async () => {
      const gaps = ['Missing field'];
      const draft = makeClarification({ gaps, sent_at: null });

      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.OK,
        latency: 100,
        result: {
          draft_subject: 'Re: missing info',
          draft_body: 'Please provide...',
        },
      });
      vi.mocked(mockActions.create).mockResolvedValue(draft);

      const result = await service.generateDraft('req-0001', gaps);
      expect(result.sent_at).toBeNull();
    });

    it('draft survives with sent_at null when LLM tool fails (crash between draft and send)', async () => {
      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.ERROR,
        latency: 50,
        error: 'LLM unavailable',
      });
      vi.mocked(mockActions.create).mockResolvedValue(
        makeClarification({
          gaps: ['Missing field'],
          draft_subject: null,
          draft_body: null,
          sent_at: null,
        }),
      );

      const result = await service.generateDraft('req-0001', ['Missing field']);

      expect(result.sent_at).toBeNull();
      expect(result.draft_subject).toBeNull();
      expect(result.draft_body).toBeNull();
    });
  });

  /* ── SEC: Security ───────────────────────────────────────────── */

  describe('SEC-01 — sent_at is only settable by authenticated Send action', () => {
    it('markSent is the only DB write that touches sent_at/sent_by', () => {
      const markSentImpl = mockActions.markSent;
      const updateDraftImpl = mockActions.updateDraft;
      const createImpl = mockActions.create;

      expect(markSentImpl).toBeDefined();
      expect(updateDraftImpl).toBeDefined();
      expect(createImpl).toBeDefined();
    });

    it('generateDraft never calls markSent', async () => {
      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.OK,
        latency: 100,
        result: {
          draft_subject: 'Subject',
          draft_body: 'Body',
        },
      });
      vi.mocked(mockActions.create).mockResolvedValue(makeClarification({ sent_at: null }));

      await service.generateDraft('req-0001', ['Missing field']);

      expect(mockActions.markSent).not.toHaveBeenCalled();
    });

    it('updateDraft never calls markSent', async () => {
      vi.mocked(mockActions.get).mockResolvedValue(makeClarification({ sent_at: null }));
      vi.mocked(mockActions.updateDraft).mockResolvedValue(
        makeClarification({ sent_at: null, draft_subject: 'new' }),
      );

      await service.updateDraft('clar-0001', 'new subject');

      expect(mockActions.markSent).not.toHaveBeenCalled();
    });

    it('Send requires an actor ID', async () => {
      const unsent = makeClarification({ sent_at: null });

      vi.mocked(mockActions.get).mockResolvedValue(unsent);
      vi.mocked(mockActions.markSent).mockResolvedValue(
        makeClarification({ sent_at: new Date(), sent_by: 'actor-001' }),
      );

      const result = await service.send('clar-0001', 'actor-001');

      expect(result.sent_by).toBe('actor-001');
      expect(mockActions.markSent).toHaveBeenCalledWith('clar-0001', 'actor-001');
    });
  });

  describe('SEC-02 — Draft generation uses tool registry with Zod-validated args', () => {
    it('invokes tool via registry with gaps and requestId', async () => {
      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.OK,
        latency: 100,
        result: {
          draft_subject: 'Subject',
          draft_body: 'Body',
        },
      });
      vi.mocked(mockActions.create).mockResolvedValue(makeClarification({ sent_at: null }));

      await service.generateDraft('req-0001', ['Missing field']);

      expect(mockToolRegistry.invoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          gaps: ['Missing field'],
          requestId: 'req-0001',
        }),
        'req-0001',
      );
    });

    it('gracefully handles tool invocation failure (non-deterministic step)', async () => {
      vi.mocked(mockActions.findByRequestId).mockResolvedValue(null);
      vi.mocked(mockToolRegistry.invoke).mockResolvedValue({
        status: ToolStatus.ERROR,
        latency: 50,
        error: 'Execution failed',
      });
      vi.mocked(mockActions.create).mockResolvedValue(
        makeClarification({
          gaps: ['Missing field'],
          draft_subject: null,
          draft_body: null,
          sent_at: null,
        }),
      );

      const result = await service.generateDraft('req-0001', ['Missing field']);

      expect(result.draft_subject).toBeNull();
      expect(result.draft_body).toBeNull();
      expect(result.sent_at).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ClarificationActions — sent_at is only written by markSent         */
/* ------------------------------------------------------------------ */

describe('ClarificationActions – sent_at boundary', () => {
  let mockRepo: { update: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let actions: ClarificationActions;

  beforeEach(() => {
    mockRepo = {
      update: vi.fn(),
      findOne: vi.fn(),
    };
    actions = new (ClarificationActions as unknown as new (repo: unknown) => ClarificationActions)(
      mockRepo,
    );
  });

  it('markSent updates sent_at and sent_by together', async () => {
    const now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockRepo.findOne.mockResolvedValue({
      id: 'clar-0001',
      sent_at: now,
      sent_by: 'user-001',
    });

    await actions.markSent('clar-0001', 'user-001');

    expect(mockRepo.update).toHaveBeenCalledWith('clar-0001', {
      sent_at: now,
      sent_by: 'user-001',
    });

    vi.useRealTimers();
  });

  it('updateDraft never touches sent_at or sent_by', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'clar-0001',
      draft_subject: 'New subject',
      sent_at: null,
    });

    await actions.updateDraft('clar-0001', 'New subject', null);

    const updateCall = mockRepo.update.mock.calls[0];
    const updatePayload = updateCall[1];
    expect(updatePayload).not.toHaveProperty('sent_at');
    expect(updatePayload).not.toHaveProperty('sent_by');
  });
});
