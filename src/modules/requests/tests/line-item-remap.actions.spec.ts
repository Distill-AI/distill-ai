import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { MANUAL_OVERRIDE_FLAG } from '@modules/pricing/quote-recompute.service';
import { LineItemRemapActions } from '../actions/line-item-remap.actions';
import { Request } from '../entities/request.entity';
import { RequestStatus } from '../enums/request-status.enum';
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
          unit_price_minor: null,
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

  const lineItems = { get: vi.fn().mockResolvedValueOnce(line).mockResolvedValue(updated) };
  const skus = {
    findOne: vi
      .fn()
      .mockResolvedValue(
        overrides.sku === undefined ? { id: 'sku-new', org_id: 'org-1' } : overrides.sku,
      ),
  };
  const recompute = { recompute: vi.fn().mockResolvedValue(overrides.recompute ?? RECOMPUTE_OK) };

  // The whole flow runs in one transaction: capture every em.update with its entity.
  const emUpdates: Array<{
    entity: unknown;
    where: { id: string };
    payload: Record<string, unknown>;
  }> = [];
  const em = {
    update: vi.fn((entity: unknown, where: { id: string }, payload: Record<string, unknown>) => {
      emUpdates.push({ entity, where, payload });
      return Promise.resolve();
    }),
  };
  const dataSource = { transaction: vi.fn((cb: (em: unknown) => Promise<unknown>) => cb(em)) };

  const action = new LineItemRemapActions(
    lineItems as never,
    skus as never,
    recompute as never,
    dataSource as never,
  );
  const lineUpdate = () => emUpdates.find((u) => u.entity === LineItem)?.payload;
  const requestUpdate = () => emUpdates.find((u) => u.entity === Request)?.payload;
  return { action, lineItems, skus, recompute, em, lineUpdate, requestUpdate };
}

describe('LineItemRemapActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC-01/AC-02: re-maps the line to 100%, recomputes in a transaction, returns server totals', async () => {
    const { action, recompute, em, lineUpdate } = setup();
    const dto: PatchLineItemDto = { sku_id: 'sku-new' };

    const result = await action.remap(REQUEST, 'li-1', dto);

    expect(lineUpdate()).toMatchObject({ matched_sku_id: 'sku-new', match_confidence: 1 });
    expect(lineUpdate()?.flags).not.toContain('close_tie');
    // recompute runs with the SAME transaction manager that applied the line update (atomic).
    expect(recompute.recompute).toHaveBeenCalledWith('req-1', 'org-1', em);
    expect(result.quote).toMatchObject({ total_minor: 90000, blocked: false });
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

  it('rejects override:true with no manual price (in body or persisted) with a 400', async () => {
    const { action, recompute } = setup();
    await expect(action.remap(REQUEST, 'li-1', { override: true })).rejects.toBeInstanceOf(
      CustomHttpException,
    );
    expect(recompute.recompute).not.toHaveBeenCalled();
  });

  it('EC-04: routes the request to needs_review (in the same transaction) when blocked', async () => {
    const { action, requestUpdate } = setup({ recompute: { ...RECOMPUTE_OK, blocked: true } });
    await action.remap(REQUEST, 'li-1', { sku_id: 'sku-new' });
    expect(requestUpdate()).toMatchObject({ status: RequestStatus.NEEDS_REVIEW });
  });

  it('marks the line overridden and stores the manual price when override is set', async () => {
    const { action, lineUpdate } = setup();
    await action.remap(REQUEST, 'li-1', { override: true, unit_price_minor: 1234 });
    expect(lineUpdate()?.flags).toContain(MANUAL_OVERRIDE_FLAG);
    expect(lineUpdate()?.unit_price_minor).toBe(1234);
  });

  it('persists a manual price sent without an explicit override (price implies override)', async () => {
    const { action, lineUpdate } = setup();
    await action.remap(REQUEST, 'li-1', { unit_price_minor: 1234 });
    expect(lineUpdate()?.unit_price_minor).toBe(1234);
    expect(lineUpdate()?.flags).toContain(MANUAL_OVERRIDE_FLAG);
  });

  it('clears the override flag when override:false is sent', async () => {
    const { action, lineUpdate } = setup({
      line: {
        id: 'li-1',
        request_id: 'req-1',
        unit_price_minor: 900,
        flags: [MANUAL_OVERRIDE_FLAG],
      },
    });
    await action.remap(REQUEST, 'li-1', { override: false });
    expect(lineUpdate()?.flags).not.toContain(MANUAL_OVERRIDE_FLAG);
  });
});
