import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { EventsService } from '@modules/events/events.service';
import type { PricingRuleModelAction } from '../pricing-rule.model-action';
import type { QuoteModelAction, ReplaceQuoteInput } from '@modules/quotes/quote.model-action';
import type { PricingRuleSet } from '../interfaces/pricing.interfaces';
import { QuotePricingService } from '../quote-pricing.service';
import { PriceNode } from '../price.node';
import { PRICING_BLOCKED_FLAG } from '../pricing.constants';

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
    update: vi.fn((_entity: unknown, where: { id: string }, payload: Record<string, unknown>) => {
      updateCalls.push({ where, payload });
      // Mutate the in-memory line flags so a re-run on the same fixture sees persisted state.
      const target = lines.find((l) => l.id === where.id);
      if (target && Array.isArray(payload.flags)) target.flags = payload.flags as string[];
      return Promise.resolve();
    }),
  };
  const dataSource = {
    transaction: vi.fn((cb: (em: unknown) => Promise<unknown>) => cb(em)),
  };

  const lineItems = {
    list: vi.fn().mockResolvedValue({ payload: lines }),
  } as unknown as { list: ReturnType<typeof vi.fn> };

  const pricingRules = {
    getRuleSetForOrg: vi.fn().mockResolvedValue(ruleSet),
  } as unknown as PricingRuleModelAction;

  const replaceCalls: ReplaceQuoteInput[] = [];
  const deleteCalls: string[] = [];
  const quotes = {
    replaceForRequest: vi.fn((input: ReplaceQuoteInput) => {
      replaceCalls.push(input);
      return Promise.resolve({ id: 'quote-1' });
    }),
    deleteForRequest: vi.fn((requestId: string) => {
      deleteCalls.push(requestId);
      return Promise.resolve();
    }),
  } as unknown as QuoteModelAction;

  const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
  const registry = new NodeRegistry();

  const node = new PriceNode(
    registry,
    lineItems as never,
    pricingRules,
    new QuotePricingService(),
    quotes,
    events,
    dataSource as never,
  );

  return { node, registry, events, quotes, replaceCalls, deleteCalls, updateCalls };
}

describe('PriceNode', () => {
  let ctx: { requestId: string; orgId: string };

  beforeEach(() => {
    ctx = { requestId: 'req-1', orgId: 'org-1' };
  });

  it('registers itself at the price slot and advances to policy', async () => {
    const { node, registry } = setup([makeLine()]);
    expect(registry.has(CurrentNode.PRICE)).toBe(true);

    const result = await node.run(ctx);
    expect(result).toEqual({ kind: 'advance', next: CurrentNode.POLICY });
  });

  it('AC-03: persists the quote totals and priced lines, and makes no tool call', async () => {
    const { node, replaceCalls, updateCalls, events } = setup([makeLine({ quantity: 500 })]);
    await node.run(ctx);

    // Quote totals (500 units, 10% break on a 1000-minor base): total 450000.
    expect(replaceCalls).toHaveLength(1);
    expect(replaceCalls[0]).toMatchObject({
      requestId: 'req-1',
      orgId: 'org-1',
      quoteNumber: 'Q-req-1',
      currency: 'GBP',
      subtotalMinor: 500000,
      discountMinor: 50000,
      totalMinor: 450000,
      leadTimeDays: 7,
    });
    expect(replaceCalls[0].lines[0]).toMatchObject({ unitPriceMinor: 900, amountMinor: 450000 });

    // Priced line written back to line_items.
    expect(updateCalls[0].payload).toMatchObject({ unit_price_minor: 900, lead_time_days: 7 });

    // The price node is structurally outside the tool registry: it emits no tool.invoked event.
    const emittedEvents = (events.emit as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { eventName: string }).eventName,
    );
    expect(emittedEvents).toContain('pricing.completed');
    expect(emittedEvents).not.toContain('tool.invoked');
  });

  it('clears any prior quote and persists none when nothing is priceable', async () => {
    const { node, replaceCalls, deleteCalls, events } = setup([
      makeLine({ matched_sku: null, matched_sku_id: null }),
    ]);
    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.POLICY });
    expect(replaceCalls).toHaveLength(0);
    // A quote left by an earlier run must be dropped so the request carries no stale totals.
    expect(deleteCalls).toEqual(['req-1']);
    const completed = (events.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[0] as { eventName: string }).eventName === 'pricing.completed',
    );
    expect((completed?.[0] as { quoteId: string | null }).quoteId).toBeNull();
  });

  it('skips lines with a missing quantity', async () => {
    const { node, replaceCalls } = setup([
      makeLine({ id: 'a', position: 1, quantity: null }),
      makeLine({ id: 'b', position: 2, quantity: 60 }),
    ]);
    await node.run(ctx);
    // Only the priceable line survives; its distinct position proves the null-quantity line was dropped.
    expect(replaceCalls[0].lines).toHaveLength(1);
    expect(replaceCalls[0].lines[0].position).toBe(2);
    expect(replaceCalls[0].lines[0].quantity).toBe(60);
  });

  it('EC-02: with no pricing rules, prices at base, flags the line, and emits a stage error', async () => {
    const { node, replaceCalls, updateCalls, events } = setup([makeLine({ quantity: 500 })], {
      hasAnyRules: false,
      quantityBreaks: [],
    });
    await node.run(ctx);

    expect(replaceCalls[0].totalMinor).toBe(500000); // base price, not zero
    expect(updateCalls[0].payload.flags).toContain(PRICING_BLOCKED_FLAG);

    const stageError = (events.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[0] as { eventName: string }).eventName === 'stage.error',
    );
    expect((stageError?.[0] as { attributes: { reason: string } }).attributes.reason).toBe(
      'pricing_rule_missing',
    );
  });

  it('EC-03: re-running the same request reuses persisted state without double discounting', async () => {
    // One fixture, two runs on the same node. The fake persistence mutates the line flags between
    // runs (see setup), so this proves idempotency against persisted state, not just a pure function.
    const { node, replaceCalls, updateCalls } = setup([makeLine({ quantity: 500 })]);
    await node.run(ctx);
    await node.run(ctx);

    expect(replaceCalls).toHaveLength(2);
    expect(JSON.stringify(replaceCalls[0])).toBe(JSON.stringify(replaceCalls[1]));
    // The discount is applied once per run, never compounded from the prior run's persisted price.
    expect(replaceCalls[1].totalMinor).toBe(450000);
    // No blocked flag accumulates on a successful re-run.
    for (const call of updateCalls) {
      expect(call.payload.flags).not.toContain(PRICING_BLOCKED_FLAG);
    }
  });
});
