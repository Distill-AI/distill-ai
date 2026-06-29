import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { EventsService } from '@modules/events/events.service';
import type { PolicyRuleModelAction } from '../policy-rule.model-action';
import type { PolicyRuleSet } from '../interfaces/policy.interfaces';
import { QuotePolicyService } from '../quote-policy.service';
import { PolicyNode } from '../policy.node';
import { MARGIN_FLOOR_BREACH_FLAG, POLICY_BLOCKED_FLAG } from '../policy.constants';

interface FakeLine {
  id: string;
  position: number;
  unit_price_minor: number | null;
  matched_sku: { base_price_minor: number; cost_minor: number | null } | null;
  flags: string[];
}

function makeLine(overrides: Partial<FakeLine> = {}): FakeLine {
  return {
    id: 'li-1',
    position: 1,
    unit_price_minor: 900,
    matched_sku: { base_price_minor: 1000, cost_minor: 850 },
    flags: [],
    ...overrides,
  };
}

const RULES: PolicyRuleSet = { marginFloorPct: 15, maxDiscountPct: 20, hasAnyRules: true };

function setup(lines: FakeLine[], ruleSet: PolicyRuleSet = RULES) {
  const updateCalls: Array<{ where: unknown; payload: Record<string, unknown> }> = [];
  const em = {
    update: vi.fn((_e: unknown, where: unknown, payload: Record<string, unknown>) => {
      updateCalls.push({ where, payload });
      return Promise.resolve();
    }),
  };
  const dataSource = {
    transaction: vi.fn((cb: (em: unknown) => Promise<unknown>) => cb(em)),
  };
  const lineItems = {
    list: vi.fn().mockResolvedValue({ payload: lines }),
  } as unknown as { list: ReturnType<typeof vi.fn> };
  const policyRules = {
    getRuleSetForOrg: vi.fn().mockResolvedValue(ruleSet),
  } as unknown as PolicyRuleModelAction;
  const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
  const registry = new NodeRegistry();

  const node = new PolicyNode(
    registry,
    lineItems as never,
    policyRules,
    new QuotePolicyService(),
    events,
    dataSource as never,
  );
  return { node, registry, events, updateCalls };
}

const ctx = { requestId: 'req-1', orgId: 'org-1' };

describe('PolicyNode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers at the policy slot and advances to score', async () => {
    const { node, registry } = setup([makeLine()]);
    expect(registry.has(CurrentNode.POLICY)).toBe(true);
    const result = await node.run(ctx);
    expect(result).toEqual({ kind: 'advance', next: CurrentNode.SCORE });
  });

  it('AC-03: flags a margin breach and emits policy.completed without any tool call', async () => {
    // unit 900, cost 850 -> margin 5.5% < 15% floor.
    const { node, updateCalls, events } = setup([makeLine({ unit_price_minor: 900 })]);
    await node.run(ctx);

    expect(updateCalls[0].payload.flags).toContain(MARGIN_FLOOR_BREACH_FLAG);
    const emitted = (events.emit as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { eventName: string }).eventName,
    );
    expect(emitted).toContain('policy.completed');
    expect(emitted).not.toContain('tool.invoked');
  });

  it('EC-02: fails closed and flags every priced line when no rules are configured', async () => {
    const { node, updateCalls } = setup([makeLine({ id: 'a' }), makeLine({ id: 'b' })], {
      marginFloorPct: null,
      maxDiscountPct: null,
      hasAnyRules: false,
    });
    await node.run(ctx);
    expect(updateCalls).toHaveLength(2);
    expect(
      updateCalls.every((c) => (c.payload.flags as string[]).includes(POLICY_BLOCKED_FLAG)),
    ).toBe(true);
  });

  it('writes no flags for a healthy quote within both limits', async () => {
    const { node, updateCalls, events } = setup([
      makeLine({ unit_price_minor: 950, matched_sku: { base_price_minor: 1000, cost_minor: 700 } }),
    ]);
    await node.run(ctx);
    expect(updateCalls).toHaveLength(0);
    const completed = (events.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[0] as { eventName: string }).eventName === 'policy.completed',
    );
    expect((completed?.[0] as { attributes: { breached: boolean } }).attributes.breached).toBe(
      false,
    );
  });

  it('advances without evaluating when no priced lines exist', async () => {
    const { node, updateCalls } = setup([makeLine({ unit_price_minor: null })]);
    const result = await node.run(ctx);
    expect(result).toEqual({ kind: 'advance', next: CurrentNode.SCORE });
    expect(updateCalls).toHaveLength(0);
  });

  it('EC-03: a re-run with the breach flag already present makes no redundant write', async () => {
    const { node, updateCalls } = setup([
      makeLine({ unit_price_minor: 900, flags: [MARGIN_FLOOR_BREACH_FLAG] }),
    ]);
    await node.run(ctx);
    // The line already carries exactly the right flag, so the flag set is unchanged: no duplicate,
    // no write.
    expect(updateCalls).toHaveLength(0);
  });

  it('clears a stale policy flag on a healthy re-run but preserves non-policy flags', async () => {
    // unit 950, base 1000, cost 700 -> 26.3% margin, 5% discount: healthy, but a prior run left the
    // breach flag (and an unrelated close_tie flag) on the line.
    const { node, updateCalls } = setup([
      makeLine({
        unit_price_minor: 950,
        matched_sku: { base_price_minor: 1000, cost_minor: 700 },
        flags: [MARGIN_FLOOR_BREACH_FLAG, 'close_tie'],
      }),
    ]);
    await node.run(ctx);

    expect(updateCalls).toHaveLength(1);
    const flags = updateCalls[0].payload.flags as string[];
    expect(flags).not.toContain(MARGIN_FLOOR_BREACH_FLAG);
    expect(flags).toContain('close_tie');
  });
});
