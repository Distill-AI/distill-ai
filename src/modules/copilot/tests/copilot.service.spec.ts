import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { RoutingReasonCode } from '@modules/scoring/enums/routing-reason-code.enum';
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

describe('CopilotService', () => {
  describe('EC-02: short-circuit for non-needs_review requests', () => {
    it('returns empty explanation without calling the tool or fetching line items for auto_eligible', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'should not be used', degraded: false },
      });
      const service = new CopilotService(lineItems, toolRegistry);

      const result = await service.getExplanation(
        buildRequest({ routing: RequestRouting.AUTO_ELIGIBLE }),
      );

      expect(result).toEqual({ explanation: '', degraded: false });
      expect(toolRegistry.invoke).not.toHaveBeenCalled();
      expect(lineItems.list).not.toHaveBeenCalled();
    });

    it('returns empty explanation without calling the tool or fetching line items when routing is null', async () => {
      const lineItems = createMockLineItems([]);
      const toolRegistry = createMockToolRegistry({
        status: ToolStatus.OK,
        latency: 1,
        result: { explanation: 'should not be used', degraded: false },
      });
      const service = new CopilotService(lineItems, toolRegistry);

      const result = await service.getExplanation(buildRequest({ routing: null }));

      expect(result).toEqual({ explanation: '', degraded: false });
      expect(toolRegistry.invoke).not.toHaveBeenCalled();
      expect(lineItems.list).not.toHaveBeenCalled();
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
      const service = new CopilotService(lineItems, toolRegistry);

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
      const service = new CopilotService(lineItems, toolRegistry);

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
      const service = new CopilotService(lineItems, toolRegistry);

      await expect(service.getExplanation(buildRequest())).rejects.toThrow(CustomHttpException);
      try {
        await service.getExplanation(buildRequest());
        expect.unreachable();
      } catch (err) {
        expect((err as CustomHttpException).getStatus()).toBe(HttpStatus.FAILED_DEPENDENCY);
      }
    });
  });
});
