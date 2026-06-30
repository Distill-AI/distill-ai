import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { MANUAL_OVERRIDE_FLAG } from '@modules/pricing/quote-recompute.service';
import { LineItemRemapActions } from '../actions/line-item-remap.actions';
import { RequestStatus } from '../enums/request-status.enum';
import type { Request } from '../entities/request.entity';
import type { PatchLineItemDto } from '../dto/patch-line-item.dto';

const REQUEST = { id: 'req-1', org_id: 'org-1' } as Request;

const RECOMPUTE_OK = {
  quoteId: 'quote-1',
  subtotalMinor: 100000,
  discountMinor: 10000,
  totalMinor: 90000,
  leadTimeDays: 7,
  blocked: false,
};

function setup(
  overrides: {
    line?: Record<string, unknown> | null;
    sku?: Record<string, unknown> | null;
    recompute?: typeof RECOMPUTE_OK;
  } = {},
) {
  const line =
    overrides.line === undefined
      ? {
          id: 'li-1',
          request_id: 'req-1',
          matched_sku_id: 'sku-old',
          quantity: 100,
          flags: ['close_tie'],
        }
      : overrides.line;
  const updated = {
    id: 'li-1',
    matched_sku_id: 'sku-new',
    quantity: 100,
    unit_price_minor: 900,
    match_confidence: 1,
  };

  const lineItemGet = vi.fn().mockResolvedValueOnce(line).mockResolvedValue(updated);
  const updateCalls: Array<Record<string, unknown>> = [];
  const lineItems = {
    get: lineItemGet,
    update: vi.fn((opts: { updatePayload: Record<string, unknown> }) => {
      updateCalls.push(opts.updatePayload);
      return Promise.resolve(updated);
    }),
  };
  const skus = {
    findOne: vi
      .fn()
      .mockResolvedValue(
        overrides.sku === undefined ? { id: 'sku-new', org_id: 'org-1' } : overrides.sku,
      ),
  };
  const recompute = { recompute: vi.fn().mockResolvedValue(overrides.recompute ?? RECOMPUTE_OK) };
  const requests = { setStatus: vi.fn().mockResolvedValue(undefined) };

  const action = new LineItemRemapActions(
    lineItems as never,
    skus as never,
    recompute as never,
    requests as never,
  );
  return { action, lineItems, skus, recompute, requests, updateCalls };
}

describe('LineItemRemapActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC-01/AC-02: re-maps the line to 100%, recomputes, and returns server totals', async () => {
    const { action, recompute, updateCalls } = setup();
    const dto: PatchLineItemDto = { sku_id: 'sku-new' };

    const result = await action.remap(REQUEST, 'li-1', dto);

    expect(updateCalls[0]).toMatchObject({ matched_sku_id: 'sku-new', match_confidence: 1 });
    expect(updateCalls[0].flags).not.toContain('close_tie'); // a confirmed match is no longer a close tie
    expect(recompute.recompute).toHaveBeenCalledWith('req-1', 'org-1');
    expect(result.quote).toMatchObject({
      total_minor: 90000,
      subtotal_minor: 100000,
      blocked: false,
    });
    expect(result.line.id).toBe('li-1');
  });

  it('rejects an empty body with a 400', async () => {
    const { action } = setup();
    await expect(action.remap(REQUEST, 'li-1', {})).rejects.toBeInstanceOf(CustomHttpException);
  });

  it('returns 404 when the line does not belong to the request', async () => {
    const { action } = setup({ line: { id: 'li-1', request_id: 'other-req', flags: [] } });
    await expect(action.remap(REQUEST, 'li-1', { sku_id: 'sku-new' })).rejects.toBeInstanceOf(
      CustomHttpException,
    );
  });

  it('returns 404 for a cross-org or unknown SKU without enumerating (SEC-01)', async () => {
    const { action, recompute } = setup({ sku: null });
    await expect(action.remap(REQUEST, 'li-1', { sku_id: 'sku-x' })).rejects.toBeInstanceOf(
      CustomHttpException,
    );
    expect(recompute.recompute).not.toHaveBeenCalled();
  });

  it('EC-04: routes the request to needs_review when recompute is blocked', async () => {
    const { action, requests } = setup({ recompute: { ...RECOMPUTE_OK, blocked: true } });
    await action.remap(REQUEST, 'li-1', { sku_id: 'sku-new' });
    expect(requests.setStatus).toHaveBeenCalledWith('req-1', RequestStatus.NEEDS_REVIEW);
  });

  it('marks the line overridden and stores the manual price when override is set', async () => {
    const { action, updateCalls } = setup();
    await action.remap(REQUEST, 'li-1', { override: true, unit_price_minor: 1234 });
    expect(updateCalls[0].flags).toContain(MANUAL_OVERRIDE_FLAG);
    expect(updateCalls[0].unit_price_minor).toBe(1234);
  });
});
