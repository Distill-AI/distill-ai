import { describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';

vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 0.5,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';

function makeFakeRequests(startNode: CurrentNode) {
  const record = {
    id: 'req-1',
    org_id: 'org-1',
    current_node: startNode,
    status: RequestStatus.PARSING,
    routing: null,
    routing_reasons: null,
    overall_confidence: null,
    processing_started_at: null,
  } as unknown as Request;

  return {
    record,
    get: vi.fn().mockImplementation(() => Promise.resolve(record)),
    update: vi.fn().mockImplementation(({ updatePayload }) => {
      Object.assign(record, updatePayload);
      return Promise.resolve(record);
    }),
    setCurrentNode: vi.fn().mockImplementation((_id: string, node: CurrentNode) => {
      record.current_node = node;
      return Promise.resolve();
    }),
    setStatus: vi.fn().mockImplementation((_id: string, status: RequestStatus) => {
      record.status = status;
      return Promise.resolve();
    }),
    markProcessing: vi.fn().mockImplementation((_id: string) => {
      record.status = RequestStatus.PARSING;
      record.processing_started_at = new Date(0);
      return Promise.resolve();
    }),
  };
}

describe('score routing (graph integration)', () => {
  it('terminal status is needs_review when extraction fails (scoreExtractionFailure path)', async () => {
    const requests = makeFakeRequests(CurrentNode.SCORE);
    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;

    const extractions = {
      findByRequestId: vi.fn().mockResolvedValue({
        schema_valid: false,
        status: ExtractionStatus.FAILED,
        raw_json: {},
      }),
    } as unknown as ExtractionModelAction;

    const lineItems = {
      find: vi.fn().mockResolvedValue({ payload: [] }),
    } as unknown as LineItemModelAction;

    const scoringConfig = {
      getAutoThreshold: vi.fn().mockReturnValue(0.95),
      getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
    };

    const registry = new NodeRegistry();
    new ScoreNode(
      registry,
      new ScorerService(),
      scoringConfig as unknown as ConstructorParameters<typeof ScoreNode>[2],
      requests as unknown as RequestModelAction,
      extractions,
      lineItems,
      events,
    );

    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events,
    );

    await engine.run('req-1');

    expect(requests.record.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(requests.record.routing_reasons).toEqual([
      expect.objectContaining({ code: 'extraction_failed' }),
    ]);
    expect(requests.record.current_node).toBe(CurrentNode.DONE);
    expect(requests.record.status).toBe(RequestStatus.NEEDS_REVIEW);
  });

  it('terminal status is priced when score routes to auto_eligible', async () => {
    const requests = makeFakeRequests(CurrentNode.SCORE);
    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;

    const extractions = {
      findByRequestId: vi.fn().mockResolvedValue({
        schema_valid: true,
        status: ExtractionStatus.COMPLETED,
      }),
    } as unknown as ExtractionModelAction;

    const lineItems = {
      find: vi.fn().mockResolvedValue({
        payload: [{ match_confidence: 0.99, unit_price_minor: 1000, quantity: 1, flags: [] }],
      }),
    } as unknown as LineItemModelAction;

    const scoringConfig = {
      getAutoThreshold: vi.fn().mockReturnValue(0.95),
      getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
    };

    const registry = new NodeRegistry();
    new ScoreNode(
      registry,
      new ScorerService(),
      scoringConfig as unknown as ConstructorParameters<typeof ScoreNode>[2],
      requests as unknown as RequestModelAction,
      extractions,
      lineItems,
      events,
    );

    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events,
    );

    await engine.run('req-1');

    expect(requests.record.routing).toBe(RequestRouting.AUTO_ELIGIBLE);
    expect(requests.record.current_node).toBe(CurrentNode.DONE);
    expect(requests.record.status).toBe(RequestStatus.PRICED);
  });
});
