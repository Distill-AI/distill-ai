import { describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { LineItemModelAction } from '../line-item.model-action';
import type { CandidateMatchModelAction } from '../candidate-match.model-action';
import { LineItemsService } from '../line-items.service';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';

const ORG_ID = 'org-uuid';
const OTHER_ORG_ID = 'other-org-uuid';
const LINE_ID = 'line-uuid';
const REQUEST_ID = 'req-uuid';

function makeLineItem(orgId = ORG_ID) {
  return { id: LINE_ID, request_id: REQUEST_ID, request: { org_id: orgId } };
}

function makeCandidate(rank: number, score: number) {
  return {
    rank,
    score,
    sku_id: `sku-${rank}`,
    line_item_id: LINE_ID,
    sku: {
      sku_code: `CODE-${rank}`,
      name: `Item ${rank}`,
      description: null,
      base_price_minor: 10000 * rank,
      currency: 'GBP',
      lead_time_days: null,
    },
  };
}

function makeService(getResult: unknown, listPayload: unknown[]) {
  const lineItemModelAction = {
    get: vi.fn().mockResolvedValue(getResult),
  } as unknown as LineItemModelAction;

  const candidateMatchModelAction = {
    list: vi
      .fn()
      .mockResolvedValue({ payload: listPayload, paginationMeta: { total: listPayload.length } }),
  } as unknown as CandidateMatchModelAction;

  return { service: new LineItemsService(lineItemModelAction, candidateMatchModelAction) };
}

describe('LineItemsService.getCandidates', () => {
  it('returns empty array when no candidates exist (EC-01)', async () => {
    const { service } = makeService(makeLineItem(), []);
    const result = await service.getCandidates(LINE_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns candidates ordered by rank with all fields mapped (AC-01, AC-02)', async () => {
    const { service } = makeService(makeLineItem(), [
      makeCandidate(1, 0.88),
      makeCandidate(2, 0.85),
    ]);
    const result = await service.getCandidates(LINE_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rank: 1,
      confidence: 0.88,
      sku_id: 'sku-1',
      sku_code: 'CODE-1',
      name: 'Item 1',
      description: null,
      base_price_minor: 10000,
      currency: 'GBP',
    });
    expect(result[1].rank).toBe(2);
  });

  it('throws 404 when line item does not exist (EC-02)', async () => {
    const { service } = makeService(null, []);
    await expect(service.getCandidates(LINE_ID, ORG_ID)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof CustomHttpException &&
        (e as CustomHttpException).getStatus() === HttpStatus.NOT_FOUND,
    );
  });

  it('throws 404 when line item belongs to a different org (EC-02 / SEC-01)', async () => {
    const { service } = makeService(makeLineItem(OTHER_ORG_ID), []);
    await expect(service.getCandidates(LINE_ID, ORG_ID)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof CustomHttpException &&
        (e as CustomHttpException).getStatus() === HttpStatus.NOT_FOUND,
    );
  });

  it('skips org check and returns candidates when callerOrgId is undefined (auth off)', async () => {
    const { service } = makeService(makeLineItem(), [makeCandidate(1, 0.88)]);
    const result = await service.getCandidates(LINE_ID, undefined);
    expect(result).toHaveLength(1);
  });
});
