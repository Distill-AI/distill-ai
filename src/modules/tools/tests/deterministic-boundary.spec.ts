import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { RESERVED_NAMES, TOOL_NAMES, toToolName } from '@modules/pipeline/types';
import { PriceNode } from '@modules/pricing/price.node';
import { QuotePricingService } from '@modules/pricing/quote-pricing.service';
import { PolicyNode } from '@modules/policy/policy.node';
import { QuotePolicyService } from '@modules/policy/quote-policy.service';
import { ScoreNode } from '@modules/scoring/score.node';
import { ScorerService } from '@modules/scoring/scorer.service';

// scoring.config validates process.env at import time and throws when the scoring vars are absent.
// Mock it so this file loads in CI without scoring env vars set. vitest hoists vi.mock above imports.
vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 1.0,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));

/**
 * US-E4-3: proves that pricing, policy, and scoring are structurally unreachable by any AI call.
 * FR-1 runtime (no tool.invoked from price/policy/score), FR-2 type/reserved-name guarantee,
 * FR-3 wiring (the deterministic nodes never reference a ToolRegistry).
 */

const DETERMINISTIC = ['price', 'policy', 'score'] as const;

function makeFakeRequests() {
  const record = {
    id: 'req-1',
    org_id: 'org-1',
    current_node: CurrentNode.PRICE,
    status: RequestStatus.PARSING,
    routing: null,
    routing_reasons: null,
    overall_confidence: null,
    processing_started_at: null,
  } as unknown as Request;

  return {
    record,
    get: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockImplementation(({ updatePayload }) => {
      Object.assign(record, updatePayload);
      return Promise.resolve(record);
    }),
    setCurrentNode: vi.fn().mockImplementation((_id: string, node: CurrentNode) => {
      record.current_node = node;
      return Promise.resolve();
    }),
    setStatus: vi.fn().mockImplementation((_id: string, status: RequestStatus) => {
      record.status = status;
      return Promise.resolve();
    }),
    markProcessing: vi.fn().mockResolvedValue(undefined),
  };
}

describe('deterministic boundary (US-E4-3)', () => {
  it('FR-1: a run through price -> policy -> score emits no tool.invoked event', async () => {
    const requests = makeFakeRequests();
    const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
    const dataSource = { transaction: vi.fn() };
    // Both deterministic nodes read line items through LineItemModelAction.list; none exist here.
    const lineItems = { list: vi.fn().mockResolvedValue({ payload: [] }) };

    const registry = new NodeRegistry();
    new PriceNode(
      registry,
      lineItems as never,
      {
        getRuleSetForOrg: vi.fn().mockResolvedValue({ quantityBreaks: [], hasAnyRules: true }),
      } as never,
      new QuotePricingService(),
      { replaceForRequest: vi.fn(), deleteForRequest: vi.fn() } as never,
      events,
      dataSource as never,
    );
    new PolicyNode(
      registry,
      lineItems as never,
      {
        getRuleSetForOrg: vi
          .fn()
          .mockResolvedValue({ marginFloorPct: 15, maxDiscountPct: 20, hasAnyRules: true }),
      } as never,
      new QuotePolicyService(),
      events,
      dataSource as never,
    );
    new ScoreNode(
      registry,
      new ScorerService(),
      requests as unknown as RequestModelAction,
      {
        findByRequestId: vi
          .fn()
          .mockResolvedValue({ schema_valid: true, status: ExtractionStatus.COMPLETED }),
      } as never,
      { find: vi.fn().mockResolvedValue({ payload: [] }) } as never,
      events,
    );

    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events,
    );
    await engine.run('req-1');

    const emitted = (events.emit as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { eventName: string }).eventName,
    );
    expect(emitted).not.toContain('tool.invoked');
    expect(emitted).toContain('pricing.completed');
    expect(emitted).toContain('policy.completed');
    expect(requests.record.current_node).toBe(CurrentNode.DONE);
    // No valid line items -> deterministic core still routes to review, never auto-sends.
    expect(requests.record.routing).toBe(RequestRouting.NEEDS_REVIEW);
  });

  it('FR-2: RESERVED_NAMES and the ToolName constructor exclude price/policy/score', () => {
    expect([...RESERVED_NAMES].sort()).toEqual(['policy', 'price', 'score']);
    for (const name of DETERMINISTIC) {
      expect(() => toToolName(name)).toThrow();
      expect(TOOL_NAMES as readonly string[]).not.toContain(name);
    }
    // A non-reserved name is still constructible, so the guard is specific, not blanket.
    expect(toToolName('search_catalog')).toBe('search_catalog');
  });

  it('FR-3: the deterministic node sources never reference a ToolRegistry', () => {
    const sources: Record<string, string> = {
      price: 'src/modules/pricing/price.node.ts',
      policy: 'src/modules/policy/policy.node.ts',
      score: 'src/modules/scoring/score.node.ts',
    };
    for (const [name, rel] of Object.entries(sources)) {
      const code = stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8'));
      expect(code, `${name} node must not reference ToolRegistry`).not.toMatch(/ToolRegistry/);
    }
    // Positive control: an agentic node (match) does inject the ToolRegistry.
    const matchCode = stripComments(
      readFileSync(resolve(process.cwd(), 'src/modules/catalog/match.node.ts'), 'utf8'),
    );
    expect(matchCode).toMatch(/ToolRegistry/);
  });
});

/** Removes block and line comments so a JSDoc mention of ToolRegistry is not a false positive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
