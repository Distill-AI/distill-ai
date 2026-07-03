import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import type { RedisService } from '@modules/redis/redis.service';
import { RoutingReasonCode } from '@modules/scoring/enums/routing-reason-code.enum';
import { COPILOT_EXPLANATION_CACHE_TTL_S } from '../copilot.constants';
import { CopilotService } from '../copilot.service';

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: 'req-1',
    org_id: 'org-1',
    routing: RequestRouting.NEEDS_REVIEW,
    overall_confidence: 0.72,
    routing_reasons: [
      {
        code: RoutingReasonCode.LOW_LINE_CONFIDENCE,
        message: 'Line confidence below threshold',
        source: 'confidence',
      },
    ],
    ...overrides,
  } as Request;
}

function buildLineItems(flagSets: string[][]): LineItem[] {
  return flagSets.map((flags, i) => ({ id: `li-${i}`, flags }) as unknown as LineItem);
}

function createMockLineItems(rows: LineItem[]): LineItemModelAction {
  return {
    list: vi.fn().mockResolvedValue({ payload: rows, paginationMeta: { total: rows.length } }),
  } as unknown as LineItemModelAction;
}

function createMockToolRegistry(
  response: Awaited<ReturnType<ToolRegistry['invoke']>>,
): ToolRegistry {
  return {
    invoke: vi.fn().mockResolvedValue(response),
  } as unknown as ToolRegistry;
}

function createMockRedis(cachedValue: string | null = null): RedisService {
  return {
    get: vi.fn().mockResolvedValue(cachedValue),
    set: vi.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;
}

describe('CopilotService', () => {
  describe('EC-02: short-circuit for non-needs_review requests', () => {
    it('returns empty explanation without calling the tool, line items, or cache for auto_eligible', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'should not be used', degraded: false },
      });
      const redis = createMockRedis();
      const service = new CopilotService(lineItems, toolRegistry, redis);

      const result = await service.getExplanation(
        buildRequest({ routing: RequestRouting.AUTO_ELIGIBLE }),
      );

      expect(result).toEqual({ explanation: '', degraded: false });
      expect(toolRegistry.invoke).not.toHaveBeenCalled();
      expect(lineItems.list).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns empty explanation without calling the tool, line items, or cache when routing is null', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'should not be used', degraded: false },
      });
      const redis = createMockRedis();
      const service = new CopilotService(lineItems, toolRegistry, redis);

      const result = await service.getExplanation(buildRequest({ routing: null }));

      expect(result).toEqual({ explanation: '', degraded: false });
      expect(toolRegistry.invoke).not.toHaveBeenCalled();
      expect(lineItems.list).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  describe('policyFlags aggregation for needs_review requests', () => {
    it('excludes close_tie and manual_override, dedupes, and includes everything else', async () => {
      const lineItems = createMockLineItems(
        buildLineItems([
          ['close_tie'],
          ['pricing_blocked', 'manual_override'],
          ['margin_floor_breach'],
          ['pricing_blocked'],
        ]),
      );
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'text', degraded: false },
      });
      const redis = createMockRedis();
      const service = new CopilotService(lineItems, toolRegistry, redis);

      await service.getExplanation(buildRequest());

      expect(toolRegistry.invoke).toHaveBeenCalledTimes(1);
      const [, input] = (toolRegistry.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { policyFlags: string[] },
      ];
      expect(new Set(input.policyFlags)).toEqual(
        new Set(['pricing_blocked', 'margin_floor_breach']),
      );
      expect(input.policyFlags).not.toContain('close_tie');
      expect(input.policyFlags).not.toContain('manual_override');
    });
  });

  describe('tool result handling', () => {
    it('returns the tool result directly on success', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 10,
        result: { explanation: 'text', degraded: false },
      });
      const redis = createMockRedis();
      const service = new CopilotService(lineItems, toolRegistry, redis);

      const result = await service.getExplanation(buildRequest());

      expect(result).toEqual({ explanation: 'text', degraded: false });
    });

    it('throws a 424 CustomHttpException when the tool call fails', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.ERROR,
        latency: 10,
        error: 'boom',
      });
      const redis = createMockRedis();
      const service = new CopilotService(lineItems, toolRegistry, redis);

      await expect(service.getExplanation(buildRequest())).rejects.toThrow(CustomHttpException);
      try {
        await service.getExplanation(buildRequest());
        expect.unreachable();
      } catch (err) {
        expect((err as CustomHttpException).getStatus()).toBe(HttpStatus.FAILED_DEPENDENCY);
      }
    });
  });

  describe('Redis cache-aside', () => {
    it('returns the cached explanation on a cache hit without calling the tool', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'should not be used', degraded: false },
      });
      const redis = createMockRedis(JSON.stringify({ explanation: 'cached text', degraded: true }));
      const service = new CopilotService(lineItems, toolRegistry, redis);

      const result = await service.getExplanation(buildRequest());

      expect(result).toEqual({ explanation: 'cached text', degraded: true });
      expect(toolRegistry.invoke).not.toHaveBeenCalled();
    });

    it('writes the tool result to the cache on a cache miss', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'fresh text', degraded: false },
      });
      const redis = createMockRedis(null);
      const service = new CopilotService(lineItems, toolRegistry, redis);

      await service.getExplanation(buildRequest({ id: 'req-9' }));

      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        'copilot_explanation:req-9',
        JSON.stringify({ explanation: 'fresh text', degraded: false }),
        COPILOT_EXPLANATION_CACHE_TTL_S,
      );
    });

    it('falls through to recompute on a malformed cached value', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'fresh text', degraded: false },
      });
      const redis = createMockRedis('not-json{');
      const service = new CopilotService(lineItems, toolRegistry, redis);

      const result = await service.getExplanation(buildRequest());

      expect(result).toEqual({ explanation: 'fresh text', degraded: false });
      expect(toolRegistry.invoke).toHaveBeenCalledTimes(1);
    });
  });
});
