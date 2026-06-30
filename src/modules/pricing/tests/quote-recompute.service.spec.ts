import { describe, expect, it, vi } from 'vitest';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { Quote } from '@modules/quotes/entities/quote.entity';
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

function setup(
  lines: FakeLine[],
  ruleSet: PricingRuleSet = RULES,
  existingQuotes: { id: string }[] = [],
) {
  const updateCalls: Array<{ where: { id: string }; payload: Record<string, unknown> }> = [];
  const deleteCalls: Array<{ entity: string; where: unknown }> = [];
  // One EntityManager mock dispatching find by entity: LineItem -> lines, Quote -> existing quotes.
  const em = {
    find: vi.fn((entity: unknown) => Promise.resolve(entity === LineItem ? lines : existingQuotes)),
    update: vi.fn((_e: unknown, where: { id: string }, payload: Record<string, unknown>) => {
      updateCalls.push({ where, payload });
      return Promise.resolve();
    }),
    delete: vi.fn((entity: unknown, where: unknown) => {
      deleteCalls.push({ entity: entity === Quote ? 'Quote' : 'QuoteLineItem', where });
      return Promise.resolve();
    }),
  };
  const pricingRules = { getRuleSetForOrg: vi.fn().mockResolvedValue(ruleSet) };
  const replaceCalls: Array<Record<string, unknown>> = [];
  const quotes = {
    replaceForRequest: vi.fn((input: Record<string, unknown>) => {
      replaceCalls.push(input);
      return Promise.resolve({ id: 'quote-1' });
    }),
  };

  const svc = new QuoteRecomputeService(
    pricingRules as never,
    new QuotePricingService(),
    quotes as never,
  );
  return { svc, em, updateCalls, deleteCalls, replaceCalls };
}

describe('QuoteRecomputeService', () => {
  it('re-prices matched lines and returns server-confirmed totals', async () => {
    const { svc, em, updateCalls, replaceCalls } = setup([makeLine({ quantity: 500 })]);
    const result = await svc.recompute('req-1', 'org-1', em as never);

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

  it('org-scoped deletes the stale quote and returns empty totals when nothing is priceable', async () => {
    const { svc, em, replaceCalls, deleteCalls } = setup(
      [makeLine({ matched_sku: null, matched_sku_id: null })],
      RULES,
      [{ id: 'quote-old' }],
    );
    const result = await svc.recompute('req-1', 'org-1', em as never);

    expect(result.quoteId).toBeNull();
    expect(replaceCalls).toHaveLength(0);
    // Quote delete is scoped by request_id AND org_id.
    expect(deleteCalls.find((d) => d.entity === 'Quote')?.where).toMatchObject({
      request_id: 'req-1',
      org_id: 'org-1',
    });
  });

  it('EC-04: blocks and flags the line when the org has no applicable pricing rule', async () => {
    const { svc, em, updateCalls } = setup([makeLine({ quantity: 500 })], {
      hasAnyRules: false,
      quantityBreaks: [],
    });
    const result = await svc.recompute('req-1', 'org-1', em as never);

    expect(result.blocked).toBe(true);
    expect(result.totalMinor).toBe(500000);
    expect(updateCalls[0].payload.flags).toContain(PRICING_BLOCKED_FLAG);
  });

  it('keeps a manually overridden line at its set price, out of rule discounting', async () => {
    const { svc, em, updateCalls } = setup([
      makeLine({ quantity: 500, unit_price_minor: 850, flags: [MANUAL_OVERRIDE_FLAG] }),
    ]);
    const result = await svc.recompute('req-1', 'org-1', em as never);

    expect(result.totalMinor).toBe(425000);
    expect(result.subtotalMinor).toBe(500000);
    expect(result.blocked).toBe(false);
    expect(updateCalls[0].payload.unit_price_minor).toBe(850);
  });
});
