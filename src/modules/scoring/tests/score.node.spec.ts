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
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import * as SYS_MSG from '@constants/system-messages';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';

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
    };

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
      scoringConfig as never,
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
              code: 'extraction_failed',
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
      scoringConfig as never,
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
      scoringConfig as never,
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
          routing_reasons: [expect.objectContaining({ code: 'no_line_items' })],
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
      scoringConfig as never,
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
