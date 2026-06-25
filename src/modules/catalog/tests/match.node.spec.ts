import { describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import type { ToolRegistry } from '@modules/tools/registry';
import type { EventsService } from '@modules/events/events.service';
import type { DataSource, EntityManager } from 'typeorm';
import { MatchNode } from '../match.node';
import type { CandidateMatchModelAction } from '../candidate-match.model-action';
import { MatchMethod } from '../enums/match-method.enum';
import { env } from '@config/env';

const requestId = 'req-uuid';
const orgId = 'org-uuid';

function makeLineItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    request_id: requestId,
    position: 1,
    raw_text: 'Hydraulic Pump 5L',
    matched_sku_id: null,
    match_confidence: null,
    match_method: null,
    flags: [],
    ...overrides,
  };
}

function makeNode({
  lineItems = [makeLineItem()],
  toolResult = {
    status: 'ok',
    latency: 10,
    result: {
      candidates: [
        {
          sku_id: 'sku-1',
          sku_code: 'HP5L',
          name: 'Hydraulic Pump 5L',
          description: null,
          score: 0.92,
          rank: 1,
          match_method: MatchMethod.FUZZY,
        },
      ],
      degraded: false,
    },
  },
}: {
  lineItems?: ReturnType<typeof makeLineItem>[];
  toolResult?: Record<string, unknown>;
} = {}) {
  const manager = {
    find: vi.fn().mockResolvedValue(lineItems),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as EntityManager;

  const dataSource = {
    manager,
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (em: EntityManager) => Promise<void>) => cb(manager)),
  } as unknown as DataSource;

  const tools = {
    invoke: vi.fn().mockResolvedValue(toolResult),
  } as unknown as ToolRegistry;

  const candidateActions = {
    replaceForLineItem: vi.fn().mockResolvedValue(undefined),
  } as unknown as CandidateMatchModelAction;

  const events = {
    emit: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventsService;

  const registry = { register: vi.fn() };

  const node = new MatchNode(registry as never, tools, candidateActions, events, dataSource);

  return { node, tools, candidateActions, events, manager, dataSource };
}

describe('MatchNode', () => {
  it('advances to PRICE without tool calls when there are zero line items', async () => {
    const { node, tools } = makeNode({ lineItems: [] });

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.PRICE });
    expect(tools.invoke).not.toHaveBeenCalled();
  });

  it('advances without calling the tool when all items are already matched (resume safety)', async () => {
    const { node, tools } = makeNode({
      lineItems: [makeLineItem({ matched_sku_id: 'sku-existing' })],
    });

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.PRICE });
    expect(tools.invoke).not.toHaveBeenCalled();
  });

  it('persists candidates and denormalizes best match when the tool returns results', async () => {
    const { node, candidateActions, manager } = makeNode();

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.PRICE });
    expect(candidateActions.replaceForLineItem).toHaveBeenCalledWith(
      'item-1',
      [{ sku_id: 'sku-1', score: 0.92, rank: 1 }],
      manager,
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'item-1' },
      expect.objectContaining({ matched_sku_id: 'sku-1', match_confidence: 0.92 }),
    );
  });

  it('upgrades match_method to EXACT when score >= 0.95 and method is FUZZY', async () => {
    const { node, manager } = makeNode({
      toolResult: {
        status: 'ok',
        latency: 10,
        result: {
          candidates: [
            {
              sku_id: 'sku-exact',
              sku_code: 'EX',
              name: 'Exact Match Item',
              description: null,
              score: 0.97,
              rank: 1,
              match_method: MatchMethod.FUZZY,
            },
          ],
          degraded: false,
        },
      },
    });

    await node.run({ requestId, orgId });

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'item-1' },
      expect.objectContaining({ match_method: MatchMethod.EXACT }),
    );
  });

  it('still advances and does not throw when the tool returns degraded=true', async () => {
    const { node } = makeNode({
      toolResult: {
        status: 'ok',
        latency: 10,
        result: { candidates: [], degraded: true },
      },
    });

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.PRICE });
  });

  it('skips items with UNKNOWN raw_text and advances without candidates', async () => {
    const { node, tools, candidateActions } = makeNode({
      lineItems: [makeLineItem({ raw_text: 'UNKNOWN' })],
    });

    const result = await node.run({ requestId, orgId });

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.PRICE });
    expect(tools.invoke).not.toHaveBeenCalled();
    expect(candidateActions.replaceForLineItem).not.toHaveBeenCalled();
  });

  it('appends close_tie flag when top-2 candidates are within CLOSE_TIE_MARGIN', async () => {
    const { node, manager } = makeNode({
      toolResult: {
        status: 'ok',
        latency: 10,
        result: {
          candidates: [
            {
              sku_id: 'sku-1',
              sku_code: 'A',
              name: 'Item A',
              description: null,
              score: 0.88,
              rank: 1,
              match_method: MatchMethod.FUZZY,
            },
            {
              sku_id: 'sku-2',
              sku_code: 'B',
              name: 'Item B',
              description: null,
              score: 0.88 - env.CLOSE_TIE_MARGIN + 0.001,
              rank: 2,
              match_method: MatchMethod.FUZZY,
            },
          ],
          degraded: false,
        },
      },
    });

    await node.run({ requestId, orgId });

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'item-1' },
      expect.objectContaining({ flags: expect.arrayContaining(['close_tie']) }),
    );
  });
});
