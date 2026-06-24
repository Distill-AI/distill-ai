import { describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import * as SYS_MSG from '@constants/system-messages';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from '@modules/extraction/constants';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';

describe('ScoreNode', () => {
  const requestId = 'req-1';
  const orgId = 'org-1';

  it('persists needs_review routing when extraction schema_valid is false', async () => {
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
        schema_valid: false,
        status: ExtractionStatus.FAILED,
      }),
    } as unknown as ExtractionModelAction;

    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const registry = { register: vi.fn() };

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      requests,
      extractions,
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

  it('persists extraction_empty_source when raw_json marks empty source', async () => {
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
        schema_valid: false,
        status: ExtractionStatus.FAILED,
        raw_json: { failure_code: EXTRACTION_FAILURE_EMPTY_SOURCE },
      }),
    } as unknown as ExtractionModelAction;

    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const registry = { register: vi.fn() };

    const node = new ScoreNode(
      registry as never,
      new ScorerService(),
      requests,
      extractions,
      events,
    );

    await node.run({ requestId, orgId });

    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          routing_reasons: [
            expect.objectContaining({
              code: 'extraction_empty_source',
              message: SYS_MSG.EXTRACTION_SOURCE_TEXT_EMPTY,
            }),
          ],
        }),
      }),
    );
  });
});
