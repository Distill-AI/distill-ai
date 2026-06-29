import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolCallsActions } from '@modules/tools/actions/tool-calls.actions';
import { ScoreNode } from '@modules/scoring/score.node';
import { ScorerService } from '@modules/scoring/scorer.service';
import type { ScoringConfigService } from '@modules/scoring/scoring-config.service';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';

vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 0.5,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));

describe('boundary', () => {
  it('placeholder — assertions wired in E4 / US-E4-3', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('price node produces zero tool_call rows');
  it.todo('policy node produces zero tool_call rows');
  it.todo('full parse->score run: tool_calls contains only extract_request and search_catalog');
});

describe('score boundary', () => {
  it('score node produces zero tool_call rows', async () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', ScoreNode) as unknown[] | undefined;
    expect(paramTypes?.length).toBeGreaterThan(0);
    expect(paramTypes).toContain(ScorerService);
    expect(paramTypes).not.toContain(ToolRegistry);
    expect(paramTypes).not.toContain(ToolCallsActions);

    const insertLog = vi
      .spyOn(ToolCallsActions.prototype, 'insertLog')
      .mockResolvedValue(undefined);

    const requestId = 'req-boundary';
    const orgId = 'org-boundary';

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
        payload: [{ match_confidence: 0.97, unit_price_minor: 500, quantity: 1, flags: [] }],
      }),
    } as unknown as LineItemModelAction;

    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const registry = { register: vi.fn() };
    const scoringConfig = {
      getAutoThreshold: vi.fn().mockReturnValue(0.95),
      getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
    } satisfies Pick<ScoringConfigService, 'getAutoThreshold' | 'getAutoSendCapMinor'>;

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

    expect(insertLog).not.toHaveBeenCalled();
  });
});
