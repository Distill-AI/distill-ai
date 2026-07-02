import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import type { ToolRegistry } from '@modules/tools/registry';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionV1Schema } from '@modules/extraction/schemas/extraction-v1.schema';
import { reconcile } from '@modules/extraction/reconcile';
import { ExtractNode } from '@modules/extraction/extract.node';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { LineItemModelAction } from '../../catalog/line-item.model-action';
import { SEED_CORPUS } from './fixtures/seed-corpus';

const validExtraction = {
  company: 'Acme Corp',
  contact: 'Jane',
  sender_email: null as string | null,
  delivery_date: null as string | null,
  line_items: [{ position: 1, raw_text: 'Widget', quantity: 10, unit: 'pcs' }],
};

describe('reconcile', () => {
  it.each(SEED_CORPUS)(
    'seed corpus entry $id passes schema and reconcile',
    ({ sourceText, expected }) => {
      const parsed = ExtractionV1Schema.parse(expected);
      const result = reconcile(parsed, sourceText);
      expect(result.ok).toBe(true);
    },
  );

  it('rejects when line item count does not match stated total in source', () => {
    const data = ExtractionV1Schema.parse({
      ...validExtraction,
      line_items: [
        { position: 1, raw_text: 'A', quantity: 10, unit: 'pcs' },
        { position: 2, raw_text: 'B', quantity: 5, unit: 'pcs' },
        { position: 3, raw_text: 'C', quantity: 1, unit: 'pcs' },
      ],
    });
    const result = reconcile(data, 'Please quote 2 line items total');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('2 items');
    }
  });

  it('rejects when sum of quantities does not match stated total quantity', () => {
    const data = ExtractionV1Schema.parse({
      ...validExtraction,
      line_items: [
        { position: 1, raw_text: 'A', quantity: 10, unit: 'pcs' },
        { position: 2, raw_text: 'B', quantity: 5, unit: 'pcs' },
      ],
    });
    const result = reconcile(data, 'Total quantity: 20 units');
    expect(result.ok).toBe(false);
  });

  it('rejects semantically invalid delivery_date', () => {
    const result = ExtractionV1Schema.safeParse({
      ...validExtraction,
      delivery_date: '2026-02-30',
    });
    expect(result.success).toBe(false);
  });

  it('maps UNKNOWN company/contact sentinel to null during schema parse', () => {
    const parsed = ExtractionV1Schema.parse({
      ...validExtraction,
      company: 'UNKNOWN',
      contact: 'UNKNOWN',
    });
    expect(parsed.company).toBeNull();
    expect(parsed.contact).toBeNull();
  });

  it('accepts a present sender_address string', () => {
    const parsed = ExtractionV1Schema.parse({
      ...validExtraction,
      sender_address: '123 Main St, Springfield, IL 62701',
    });
    expect(parsed.sender_address).toBe('123 Main St, Springfield, IL 62701');
  });

  it('maps UNKNOWN sender_address sentinel to null during schema parse', () => {
    const parsed = ExtractionV1Schema.parse({
      ...validExtraction,
      sender_address: 'UNKNOWN',
    });
    expect(parsed.sender_address).toBeNull();
  });

  it('parses a fixture that omits sender_address as null, unchanged from before the field existed', () => {
    const parsed = ExtractionV1Schema.parse(validExtraction);
    expect(parsed.sender_address).toBeNull();
  });
});

describe('ExtractNode bounded loop', () => {
  const requestId = 'req-1';
  const orgId = 'org-1';

  function makeDataSource(): DataSource {
    return {
      transaction: vi.fn(async (work: (em: unknown) => Promise<unknown>) => work({})),
    } as unknown as DataSource;
  }

  function makeDeps(
    overrides: {
      invoke?: ReturnType<typeof vi.fn>;
      existingExtraction?: { schema_valid: boolean } | null;
    } = {},
  ) {
    const tools = {
      invoke: overrides.invoke ?? vi.fn(),
    } as unknown as ToolRegistry;

    const requests = {
      get: vi.fn().mockResolvedValue({
        id: requestId,
        org_id: orgId,
        source_body: 'Need 10 widgets',
        source_subject: null,
        sender_company: null,
        sender_contact: null,
        sender_email: null,
        delivery_date: null,
      }),
      update: vi.fn().mockResolvedValue({ id: requestId }),
    } as unknown as RequestModelAction;

    const attachments = {
      find: vi.fn().mockResolvedValue({ payload: [] }),
    } as unknown as AttachmentModelAction;

    const extractions = {
      findByRequestId: vi.fn().mockResolvedValue(overrides.existingExtraction ?? null),
      upsertForRequest: vi.fn().mockResolvedValue(undefined),
    } as unknown as ExtractionModelAction;

    const lineItems = {
      replaceForRequest: vi.fn().mockResolvedValue(undefined),
    } as unknown as LineItemModelAction;

    const events = {
      emit: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventsService;

    const registry = { register: vi.fn() };

    const node = new ExtractNode(
      registry as never,
      tools,
      requests,
      attachments,
      extractions,
      lineItems,
      events,
      makeDataSource(),
    );

    return { node, tools, extractions, lineItems, requests, events };
  }

  it('re-entry when schema_valid is already true skips the LLM call', async () => {
    const { node, tools } = makeDeps({ existingExtraction: { schema_valid: true } });

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.CLASSIFY });
    expect(tools.invoke).not.toHaveBeenCalled();
  });

  it('a valid extraction on the first attempt records reextract_count=0', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: ToolStatus.OK,
      latency: 100,
      result: validExtraction,
    });
    const { node, extractions } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(extractions.upsertForRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        schemaValid: true,
        reextractCount: 0,
      }),
      expect.anything(),
    );
  });

  it('invalid structured output after tool success triggers re-ask via safeParse', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 50,
        result: {
          company: 'Acme Corp',
          contact: 'Jane',
          sender_email: null,
          delivery_date: null,
          line_items: [],
        },
      })
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 100,
        result: validExtraction,
      });
    const { node } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(invoke).toHaveBeenCalledTimes(2);
    const secondCallArgs = invoke.mock.calls[1][1] as { priorFailure: string };
    expect(secondCallArgs.priorFailure).toContain('line_items');
  });

  it('schema failure triggers exactly one re-ask with priorFailure threaded into the prompt', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        status: ToolStatus.VALIDATION_ERROR,
        latency: 50,
        error: 'line_items: Required',
      })
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 100,
        result: validExtraction,
      });
    const { node } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1]).toEqual(
      expect.objectContaining({ priorFailure: 'line_items: Required' }),
    );
  });

  it('totals mismatch triggers exactly one re-ask with priorFailure threaded into the prompt', async () => {
    const badTotals = {
      ...validExtraction,
      line_items: [
        { position: 1, raw_text: 'A', quantity: 10, unit: 'pcs' },
        { position: 2, raw_text: 'B', quantity: 5, unit: 'pcs' },
      ],
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 50,
        result: badTotals,
      })
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 100,
        result: validExtraction,
      });
    const requests = {
      get: vi.fn().mockResolvedValue({
        id: requestId,
        org_id: orgId,
        source_body: 'Total quantity: 20 units\n10x A\n5x B',
        source_subject: null,
        sender_company: null,
        sender_contact: null,
        sender_email: null,
        delivery_date: null,
      }),
      update: vi.fn().mockResolvedValue({ id: requestId }),
    } as unknown as RequestModelAction;

    const registry = { register: vi.fn() };
    const nodeWithText = new ExtractNode(
      registry as never,
      { invoke } as unknown as ToolRegistry,
      requests,
      { find: vi.fn().mockResolvedValue({ payload: [] }) } as unknown as AttachmentModelAction,
      {
        findByRequestId: vi.fn().mockResolvedValue(null),
        upsertForRequest: vi.fn().mockResolvedValue(undefined),
      } as unknown as ExtractionModelAction,
      { replaceForRequest: vi.fn().mockResolvedValue(undefined) } as unknown as LineItemModelAction,
      { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService,
      makeDataSource(),
    );

    await nodeWithText.run({ requestId, orgId });

    expect(invoke).toHaveBeenCalledTimes(2);
    const secondCallArgs = invoke.mock.calls[1][1] as { priorFailure: string };
    expect(secondCallArgs.priorFailure).toContain('total quantity');
  });

  it('two consecutive failures escalate (schema_valid=false) and continue to classify', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: ToolStatus.ERROR,
      latency: 50,
      error: 'LLM failed',
    });
    const { node, extractions } = makeDeps({ invoke });

    const result = await node.run({ requestId, orgId });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(extractions.upsertForRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaValid: false,
        reextractCount: 1,
      }),
    );
    expect(result).toEqual({ kind: 'advance', next: CurrentNode.CLASSIFY });
  });

  it('persists a non-null sender_address from a successful extraction onto the request row', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: ToolStatus.OK,
      latency: 100,
      result: { ...validExtraction, sender_address: '123 Main St, Springfield, IL 62701' },
    });
    const { node, requests } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          sender_address: '123 Main St, Springfield, IL 62701',
        }),
      }),
    );
  });

  it('persists a null sender_address when the extraction found none', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: ToolStatus.OK,
      latency: 100,
      result: validExtraction,
    });
    const { node, requests } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({ sender_address: null }),
      }),
    );
  });

  it('a valid extraction on retry records reextract_count=1', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        status: ToolStatus.ERROR,
        latency: 50,
        error: 'timeout',
      })
      .mockResolvedValueOnce({
        status: ToolStatus.OK,
        latency: 100,
        result: validExtraction,
      });
    const { node, extractions } = makeDeps({ invoke });

    await node.run({ requestId, orgId });

    expect(extractions.upsertForRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaValid: true,
        reextractCount: 1,
      }),
      expect.anything(),
    );
  });
});
