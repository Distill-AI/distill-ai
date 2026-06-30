import { describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';
import { NodeRegistry } from '@modules/pipeline/node-registry';

vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 0.5,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import * as SYS_MSG from '@constants/system-messages';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';
import { RoutingReasonCode } from '../enums/routing-reason-code.enum';
import type { ScoringConfigService } from '../scoring-config.service';

describe('ScoreNode', () => {
  const requestId = 'req-1';
  const orgId = 'org-1';

  function makeFixture(
    overrides: {
      extractionSchemaValid?: boolean;
      extractionStatus?: ExtractionStatus;
      lineItems?: Array<{
        match_confidence: number | null;
        unit_price_minor: number | null;
        quantity: number | null;
        flags: unknown[];
      }>;
    } = {},
  ) {
    const requests = {
      get: vi.fn().mockResolvedValue({
        id: requestId,
        org_id: orgId,
        classification_confidence: 0.9,
      }),
      update: vi.fn().mockResolvedValue({ id: requestId }),
    } as unknown as RequestModelAction;

    const extractions = {
      findByRequestId: vi.fn().mockResolvedValue({
        schema_valid: overrides.extractionSchemaValid ?? true,
        status: overrides.extractionStatus ?? ExtractionStatus.COMPLETED,
      }),
    } as unknown as ExtractionModelAction;

    const items = overrides.lineItems ?? [
      { match_confidence: 0.99, unit_price_minor: 1000, quantity: 1, flags: [] },
    ];
    const lineItems = {
      find: vi.fn().mockResolvedValue({ payload: items }),
    } as unknown as LineItemModelAction;

    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const registry = { register: vi.fn() };
    const scoringConfig = {
      getAutoThreshold: vi.fn().mockReturnValue(0.95),
      getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
    } satisfies Pick<ScoringConfigService, 'getAutoThreshold' | 'getAutoSendCapMinor'>;

    return { requests, extractions, lineItems, events, registry, scoringConfig };
  }

  it('persists needs_review routing when extraction schema_valid is false', async () => {
    const { requests, extractions, lineItems, events, registry, scoringConfig } = makeFixture({
      extractionSchemaValid: false,
      extractionStatus: ExtractionStatus.FAILED,
    });

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      scoringConfig as unknown as ScoringConfigService,
      requests,
      extractions,
      lineItems,
      events,
    );

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.DONE });
    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          routing: RequestRouting.NEEDS_REVIEW,
          overall_confidence: 0,
          routing_reasons: [
            expect.objectContaining({
              code: RoutingReasonCode.EXTRACTION_FAILED,
              message: SYS_MSG.EXTRACTION_ESCALATED,
            }),
          ],
        }),
      }),
    );
  });

  it('persists auto_eligible routing when all lines are high confidence', async () => {
    const { requests, extractions, lineItems, events, registry, scoringConfig } = makeFixture({
      lineItems: [{ match_confidence: 0.99, unit_price_minor: 1000, quantity: 1, flags: [] }],
    });

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      scoringConfig as unknown as ScoringConfigService,
      requests,
      extractions,
      lineItems,
      events,
    );

    await node.run({ requestId, orgId });

    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          routing: RequestRouting.AUTO_ELIGIBLE,
        }),
      }),
    );
  });

  it('persists needs_review when no line items exist', async () => {
    const { requests, extractions, lineItems, events, registry, scoringConfig } = makeFixture({
      lineItems: [],
    });

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      scoringConfig as unknown as ScoringConfigService,
      requests,
      extractions,
      lineItems,
      events,
    );

    await node.run({ requestId, orgId });

    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          routing: RequestRouting.NEEDS_REVIEW,
          routing_reasons: [expect.objectContaining({ code: RoutingReasonCode.NO_LINE_ITEMS })],
        }),
      }),
    );
  });

  it('applies a lowered threshold on the next run with no restart (AC-02/EC-02)', async () => {
    const { requests, extractions, lineItems, events, registry, scoringConfig } = makeFixture({
      lineItems: [{ match_confidence: 0.92, unit_price_minor: 1000, quantity: 1, flags: [] }],
    });
    scoringConfig.getAutoThreshold.mockReturnValueOnce(0.95).mockReturnValueOnce(0.9);

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      scoringConfig as unknown as ScoringConfigService,
      requests,
      extractions,
      lineItems,
      events,
    );

    await node.run({ requestId, orgId });
    expect(requests.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({ routing: RequestRouting.NEEDS_REVIEW }),
      }),
    );

    await node.run({ requestId, orgId });
    expect(requests.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({ routing: RequestRouting.AUTO_ELIGIBLE }),
      }),
    );
  });
});

describe('ScoreNode determinism', () => {
  const requestId = 'req-det';
  const orgId = 'org-det';

  function makeDetFixture() {
    const requests = {
      get: vi.fn().mockResolvedValue({
        id: requestId,
        org_id: orgId,
        classification_confidence: 0.9,
      }),
      update: vi.fn().mockResolvedValue({ id: requestId }),
    } as unknown as RequestModelAction;

    const extractions = {
      findByRequestId: vi.fn().mockResolvedValue({
        schema_valid: true,
        status: ExtractionStatus.COMPLETED,
      }),
    } as unknown as ExtractionModelAction;

    const lineItems = {
      find: vi.fn().mockResolvedValue({
        payload: [{ match_confidence: 0.97, unit_price_minor: 500, quantity: 2, flags: [] }],
      }),
    } as unknown as LineItemModelAction;

    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const registry = { register: vi.fn() };
    const scoringConfig = {
      getAutoThreshold: vi.fn().mockReturnValue(0.95),
      getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
    } satisfies Pick<ScoringConfigService, 'getAutoThreshold' | 'getAutoSendCapMinor'>;

    return { requests, extractions, lineItems, events, registry, scoringConfig };
  }

  it('two independent runs on identical inputs produce identical routing decisions', async () => {
    vi.useFakeTimers();
    try {
      const a = makeDetFixture();
      const b = makeDetFixture();

      const nodeA = new ScoreNode(
        a.registry as never,
        new ScorerService(),
        a.scoringConfig as unknown as ScoringConfigService,
        a.requests,
        a.extractions,
        a.lineItems,
        a.events,
      );
      const nodeB = new ScoreNode(
        b.registry as never,
        new ScorerService(),
        b.scoringConfig as unknown as ScoringConfigService,
        b.requests,
        b.extractions,
        b.lineItems,
        b.events,
      );

      await nodeA.run({ requestId, orgId });
      await nodeB.run({ requestId, orgId });

      const payloadA = (a.requests.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .updatePayload;
      const payloadB = (b.requests.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .updatePayload;

      expect(payloadA.routing).toBe(payloadB.routing);
      expect(payloadA.overall_confidence).toBe(payloadB.overall_confidence);
      expect(payloadA.routing_reasons).toEqual(payloadB.routing_reasons);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumed engine run from SCORE checkpoint yields identical routing as direct run', async () => {
    vi.useFakeTimers();
    try {
      const {
        requests: directRequests,
        extractions,
        lineItems,
        events,
        registry,
        scoringConfig,
      } = makeDetFixture();

      const directNode = new ScoreNode(
        registry as never,
        new ScorerService(),
        scoringConfig as unknown as ScoringConfigService,
        directRequests,
        extractions,
        lineItems,
        events,
      );
      await directNode.run({ requestId, orgId });
      const directPayload = (directRequests.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .updatePayload;

      const record = {
        id: requestId,
        org_id: orgId,
        current_node: CurrentNode.SCORE,
        status: RequestStatus.PARSING,
        routing: null as string | null,
        processing_started_at: null as Date | null,
        classification_confidence: 0.9,
      };

      const engineRequests = {
        record,
        get: vi.fn().mockImplementation(() => Promise.resolve(record)),
        update: vi.fn().mockImplementation((opts: { updatePayload: Record<string, unknown> }) => {
          if (opts.updatePayload.routing) {
            record.routing = opts.updatePayload.routing as string;
          }
          return Promise.resolve(record);
        }),
        setCurrentNode: vi.fn().mockImplementation((_id: string, node: CurrentNode) => {
          record.current_node = node;
          return Promise.resolve();
        }),
        setStatus: vi.fn().mockResolvedValue(undefined),
        markProcessing: vi.fn().mockImplementation(() => {
          record.processing_started_at = new Date(0);
          return Promise.resolve();
        }),
      };

      const engExtractions = {
        findByRequestId: vi.fn().mockResolvedValue({
          schema_valid: true,
          status: ExtractionStatus.COMPLETED,
        }),
      } as unknown as ExtractionModelAction;

      const engLineItems = {
        find: vi.fn().mockResolvedValue({
          payload: [{ match_confidence: 0.97, unit_price_minor: 500, quantity: 2, flags: [] }],
        }),
      } as unknown as LineItemModelAction;

      const engEvents = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
      const engRegistry = new NodeRegistry();
      const engScoringConfig = {
        getAutoThreshold: vi.fn().mockReturnValue(0.95),
        getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
      } satisfies Pick<ScoringConfigService, 'getAutoThreshold' | 'getAutoSendCapMinor'>;

      new ScoreNode(
        engRegistry as never,
        new ScorerService(),
        engScoringConfig as unknown as ScoringConfigService,
        engineRequests as unknown as RequestModelAction,
        engExtractions,
        engLineItems,
        engEvents,
      );
      expect(engRegistry.has(CurrentNode.SCORE)).toBe(true);

      const engine = new PipelineGraphEngine(
        engRegistry,
        engineRequests as unknown as RequestModelAction,
        engEvents,
      );

      await engine.run(requestId);

      const enginePayload = (engineRequests.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .updatePayload;
      expect(enginePayload.routing).toBe(directPayload.routing);
      expect(enginePayload.overall_confidence).toBe(directPayload.overall_confidence);
      expect(enginePayload.routing_reasons).toEqual(directPayload.routing_reasons);
    } finally {
      vi.useRealTimers();
    }
  });
});
