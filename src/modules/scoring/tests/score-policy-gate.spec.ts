import { describe, expect, it, vi } from 'vitest';

// Penalty 1.0 means a flag does NOT reduce confidence, so a 0.99 line would normally auto-route.
// This isolates the US-E4-2 hard gate: a policy breach must force review independent of the penalty.
vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 1,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));

import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { ExtractionModelAction } from '@modules/extraction/extraction.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { EventsService } from '@modules/events/events.service';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { MARGIN_FLOOR_BREACH_FLAG } from '@modules/policy/policy.constants';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';
import type { ScoringConfigService } from '../scoring-config.service';

function build(flags: string[]) {
  const updatePayloads: Array<Record<string, unknown>> = [];
  const requests = {
    get: vi.fn().mockResolvedValue({ id: 'req-1', org_id: 'org-1' }),
    update: vi.fn().mockImplementation(({ updatePayload }) => {
      updatePayloads.push(updatePayload);
      return Promise.resolve({ id: 'req-1' });
    }),
  } as unknown as RequestModelAction;
  const extractions = {
    findByRequestId: vi.fn().mockResolvedValue({
      schema_valid: true,
      status: ExtractionStatus.COMPLETED,
    }),
  } as unknown as ExtractionModelAction;
  const lineItems = {
    find: vi.fn().mockResolvedValue({
      payload: [{ match_confidence: 0.99, unit_price_minor: 1000, quantity: 1, flags }],
    }),
  } as unknown as LineItemModelAction;
  const events = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventsService;
  const scoringConfig = {
    getAutoThreshold: vi.fn().mockReturnValue(0.95),
    getAutoSendCapMinor: vi.fn().mockReturnValue(undefined),
  } satisfies Pick<ScoringConfigService, 'getAutoThreshold' | 'getAutoSendCapMinor'>;

  const node = new ScoreNode(
    new NodeRegistry(),
    new ScorerService(),
    scoringConfig as unknown as ScoringConfigService,
    requests,
    extractions,
    lineItems,
    events,
  );
  return { node, updatePayloads };
}

describe('ScoreNode policy gate (US-E4-2)', () => {
  it('auto-routes a clean 99% line when no hard flag is present', async () => {
    const { node, updatePayloads } = build([]);
    await node.run({ requestId: 'req-1', orgId: 'org-1' });
    expect(updatePayloads[0].routing).toBe(RequestRouting.AUTO_ELIGIBLE);
  });

  it('AC-01: forces needs_review when a line carries a margin-floor breach, even at 99%', async () => {
    const { node, updatePayloads } = build([MARGIN_FLOOR_BREACH_FLAG]);
    await node.run({ requestId: 'req-1', orgId: 'org-1' });

    expect(updatePayloads[0].routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(updatePayloads[0].current_node).toBe(CurrentNode.DONE);
    expect(updatePayloads[0].routing_reasons).toContainEqual(
      expect.objectContaining({ code: 'policy_breach', source: 'policy' }),
    );
  });
});
