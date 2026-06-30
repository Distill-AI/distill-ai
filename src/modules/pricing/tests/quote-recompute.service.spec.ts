import { describe, expect, it, vi } from 'vitest';
import { QuotePricingService } from '../quote-pricing.service';
import { QuoteRecomputeService, MANUAL_OVERRIDE_FLAG } from '../quote-recompute.service';
import { PRICING_BLOCKED_FLAG } from '../pricing.constants';
import type { PricingRuleSet } from '../interfaces/pricing.interfaces';

interface FakeLine {
  id: string;
  request_id: string;
  position: number;
  raw_text: string;
  quantity: number | null;
  matched_sku_id: string | null;
  matched_sku: {
    name: string;
    base_price_minor: number;
    lead_time_days: number | null;
    currency: string;
  } | null;
  unit_price_minor: number | null;
  flags: string[];
}

function makeLine(overrides: Partial<FakeLine> = {}): FakeLine {
  return {
    id: 'li-1',
    request_id: 'req-1',
    position: 1,
    raw_text: 'bolts',
    quantity: 500,
    matched_sku_id: 'sku-1',
    matched_sku: { name: 'M6 bolt', base_price_minor: 1000, lead_time_days: 7, currency: 'GBP' },
    unit_price_minor: null,
    flags: [],
    ...overrides,
  };
}

const RULES: PricingRuleSet = {
  hasAnyRules: true,
  quantityBreaks: [{ minQty: 250, discountPct: 10 }],
};

function setup(lines: FakeLine[], ruleSet: PricingRuleSet = RULES) {
  const updateCalls: Array<{ where: { id: string }; payload: Record<string, unknown> }> = [];
  const em = {
    update: vi.fn((_e: unknown, where: { id: string }, payload: Record<string, unknown>) => {
      updateCalls.push({ where, payload });
      return Promise.resolve();
    }),
  };
  const dataSource = { transaction: vi.fn((cb: (em: unknown) => Promise<unknown>) => cb(em)) };
  const lineItems = { list: vi.fn().mockResolvedValue({ payload: lines }) };
  const pricingRules = { getRuleSetForOrg: vi.fn().mockResolvedValue(ruleSet) };
  const replaceCalls: Array<Record<string, unknown>> = [];
  const deleteCalls: string[] = [];
  const quotes = {
    replaceForRequest: vi.fn((input: Record<string, unknown>) => {
      replaceCalls.push(input);
      return Promise.resolve({ id: 'quote-1' });
    }),
    deleteForRequest: vi.fn((id: string) => {
      deleteCalls.push(id);
      return Promise.resolve();
    }),
  };

  const svc = new QuoteRecomputeService(
    lineItems as never,
    pricingRules as never,
    new QuotePricingService(),
    quotes as never,
    dataSource as never,
  );
  return { svc, updateCalls, replaceCalls, deleteCalls };
}

describe('QuoteRecomputeService', () => {
  it('re-prices matched lines and returns server-confirmed totals', async () => {
    const { svc, updateCalls, replaceCalls } = setup([makeLine({ quantity: 500 })]);
    const result = await svc.recompute('req-1', 'org-1');

    // 500 units, 10% break on a 1000-minor base: total 450000.
    expect(result).toMatchObject({
      quoteId: 'quote-1',
      subtotalMinor: 500000,
      discountMinor: 50000,
      totalMinor: 450000,
      leadTimeDays: 7,
      blocked: false,
    });
    expect(replaceCalls[0]).toMatchObject({ totalMinor: 450000 });
    expect(updateCalls[0].payload).toMatchObject({ unit_price_minor: 900 });
  });

  it('drops any stale quote and returns empty totals when nothing is priceable', async () => {
    const { svc, replaceCalls, deleteCalls } = setup([
      makeLine({ matched_sku: null, matched_sku_id: null }),
    ]);
    const result = await svc.recompute('req-1', 'org-1');

    expect(result.quoteId).toBeNull();
    expect(result.totalMinor).toBe(0);
    expect(replaceCalls).toHaveLength(0);
    expect(deleteCalls).toEqual(['req-1']);
  });

  it('EC-04: blocks and flags the line when the org has no applicable pricing rule', async () => {
    const { svc, updateCalls } = setup([makeLine({ quantity: 500 })], {
      hasAnyRules: false,
      quantityBreaks: [],
    });
    const result = await svc.recompute('req-1', 'org-1');

    expect(result.blocked).toBe(true);
    expect(result.totalMinor).toBe(500000); // base price, not zero
    expect(updateCalls[0].payload.flags).toContain(PRICING_BLOCKED_FLAG);
  });

  it('keeps a manually overridden line at its set price, out of rule discounting', async () => {
    const { svc, updateCalls } = setup([
      makeLine({ quantity: 500, unit_price_minor: 850, flags: [MANUAL_OVERRIDE_FLAG] }),
    ]);
    const result = await svc.recompute('req-1', 'org-1');

    // Override price 850 x 500 = 425000; no 10% break applied; not blocked (no rule-priced line).
    expect(result.totalMinor).toBe(425000);
    expect(result.subtotalMinor).toBe(500000);
    expect(result.blocked).toBe(false);
    expect(updateCalls[0].payload.unit_price_minor).toBe(850);
  });
});
