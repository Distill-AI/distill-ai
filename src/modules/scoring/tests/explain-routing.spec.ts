import { describe, expect, it, vi } from 'vitest';
import * as SYS_MSG from '@constants/system-messages';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { ToolCallsActions } from '@modules/tools/actions/tool-calls.actions';
import { EventsService } from '@modules/events/events.service';
import { LLMProvider } from '@modules/llm/llm.provider';
import { ToolName } from '@modules/pipeline/types';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { RoutingReasonCode } from '../enums/routing-reason-code.enum';
import { ExplainRoutingToolFactory } from '../tools/explain-routing.tool';

function createMockActions(): ToolCallsActions {
  return {
    insertLog: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolCallsActions;
}

function createMockEvents(): EventsService {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventsService;
}

function createMockLLM(text: string): LLMProvider {
  return {
    invoke: vi.fn().mockResolvedValue({ text }),
  } as unknown as LLMProvider;
}

function createFailingLLM(): LLMProvider {
  return {
    invoke: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
  } as unknown as LLMProvider;
}

const VALID_INPUT = {
  routing: RequestRouting.NEEDS_REVIEW,
  overallConfidence: 0.72,
  routingReasons: [
    {
      code: RoutingReasonCode.LOW_LINE_CONFIDENCE,
      message: 'Line confidence 0.72 below auto threshold 0.95',
      source: 'confidence' as const,
    },
    {
      code: RoutingReasonCode.POLICY_FLAGS_DETECTED,
      message: 'Policy flags present on one or more line items',
      source: 'confidence' as const,
    },
  ],
  policyFlags: ['margin_floor_breach'],
};

describe('ExplainRoutingTool', () => {
  describe('FR-1 / AC-01: returns plain-English paragraph covering all reasons', () => {
    it('uses LLM to produce an explanation when available', async () => {
      const llmText =
        'This quote requires manual review because line item match confidence is 72%, which is below the 95% auto-eligibility threshold. Additionally, a margin floor breach was detected on a line item.';
      const llm = createMockLLM(llmText);
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const result = await tool.execute(VALID_INPUT);

      expect(result.explanation).toBe(llmText);
      expect(result.degraded).toBe(false);
      expect(llm.invoke).toHaveBeenCalledOnce();
    });

    it('returns explanation covering multiple routing reasons', async () => {
      const llm = createMockLLM('Multiple issues found: low confidence and policy breaches.');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const input = {
        routing: RequestRouting.NEEDS_REVIEW,
        overallConfidence: 0.5,
        routingReasons: [
          {
            code: RoutingReasonCode.LOW_LINE_CONFIDENCE,
            message: 'Low confidence',
            source: 'confidence' as const,
          },
          {
            code: RoutingReasonCode.DEAL_VALUE_EXCEEDS_CAP,
            message: 'Deal value exceeds cap',
            source: 'confidence' as const,
          },
          {
            code: RoutingReasonCode.INCOMPLETE_DEAL_VALUE,
            message: 'Incomplete pricing',
            source: 'confidence' as const,
          },
        ],
        policyFlags: [],
      };

      const result = await tool.execute(input);

      expect(result.explanation).toBeTruthy();
      expect(result.explanation.length).toBeGreaterThan(10);
    });
  });

  describe('AC-02: modifies nothing and writes only its tool_calls log', () => {
    it('tool itself does not write to the database (no side effects)', async () => {
      const llm = createMockLLM('Explanation text.');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const insertLogSpy = vi.fn();
      const emitSpy = vi.fn();
      const actions = { insertLog: insertLogSpy } as unknown as ToolCallsActions;
      const events = { emit: emitSpy } as unknown as EventsService;
      const registry = new ToolRegistry(actions, events);
      registry.register(tool);

      await registry.invoke('explain_routing' as ToolName, VALID_INPUT);

      expect(insertLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'explain_routing',
          status: ToolStatus.OK,
        }),
      );
      expect(insertLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('EC-01: auto-eligible with no routing reasons returns all-clear', () => {
    it('returns a brief all-clear explanation when no reasons exist', async () => {
      const llm = createMockLLM('Everything looks good.');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const input = {
        routing: RequestRouting.AUTO_ELIGIBLE,
        overallConfidence: 0.97,
        routingReasons: [],
        policyFlags: [],
      };

      const result = await tool.execute(input);

      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe('string');
    });

    it('fallback path returns EXPLAIN_ROUTING_ALL_CLEAR for auto-eligible with no reasons', async () => {
      const llm = createFailingLLM();
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const input = {
        routing: RequestRouting.AUTO_ELIGIBLE,
        overallConfidence: 0.97,
        routingReasons: [],
        policyFlags: [],
      };

      const result = await tool.execute(input);

      expect(result.explanation).toBe(SYS_MSG.EXPLAIN_ROUTING_ALL_CLEAR);
      expect(result.degraded).toBe(true);
    });
  });

  describe('EC-02: LLM provider unavailable returns fallback, core unaffected', () => {
    it('returns degraded fallback when LLM throws', async () => {
      const llm = createFailingLLM();
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const result = await tool.execute(VALID_INPUT);

      expect(result.degraded).toBe(true);
      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe('string');
    });

    it('fallback explains all routing reasons in plain English', async () => {
      const llm = createFailingLLM();
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const result = await tool.execute(VALID_INPUT);

      expect(result.degraded).toBe(true);
      expect(result.explanation).toContain('review');
    });

    it('tool registry still succeeds (returns OK) even when LLM fails', async () => {
      const llm = createFailingLLM();
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const actions = createMockActions();
      const events = createMockEvents();
      const registry = new ToolRegistry(actions, events);
      registry.register(tool);

      const res = await registry.invoke('explain_routing' as ToolName, VALID_INPUT);

      expect(res.status).toBe(ToolStatus.OK);
      expect(res.result).toBeDefined();
      expect(res.result).toHaveProperty('explanation');
      expect(res.result).toHaveProperty('degraded', true);
      expect(actions.insertLog).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'explain_routing',
          status: ToolStatus.OK,
        }),
      );
    });
  });

  describe('SEC-01: read-only, Zod-validated, sanitised logs', () => {
    it('rejects invalid input with validation error', async () => {
      const llm = createMockLLM('test');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const actions = createMockActions();
      const events = createMockEvents();
      const registry = new ToolRegistry(actions, events);
      registry.register(tool);

      const res = await registry.invoke('explain_routing' as ToolName, {
        routing: 'invalid_routing',
        overallConfidence: 'not-a-number',
      });

      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
    });

    it('rejects missing required fields', async () => {
      const llm = createMockLLM('test');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const actions = createMockActions();
      const events = createMockEvents();
      const registry = new ToolRegistry(actions, events);
      registry.register(tool);

      const res = await registry.invoke('explain_routing' as ToolName, {});

      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
    });

    it('tool has no write path and only returns data', async () => {
      const llm = createMockLLM('Test explanation.');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const toolCode = tool.execute.toString();
      expect(toolCode).not.toContain('DataSource');
      expect(toolCode).not.toContain('Repository');
      expect(toolCode).not.toContain('.save');
      expect(toolCode).not.toContain('.insert');
      expect(toolCode).not.toContain('.update');
      expect(toolCode).not.toContain('.delete');
    });
  });

  describe('tool registration and contract', () => {
    it('registers successfully in ToolRegistry', () => {
      const llm = createMockLLM('test');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const registry = new ToolRegistry(createMockActions(), createMockEvents());
      registry.register(tool);

      const tools = registry.list();
      const found = tools.find((t) => t.toolName === 'explain_routing');
      expect(found).toBeDefined();
      expect(found?.description).toContain('plain-English');
    });

    it('output schema validates correctly', async () => {
      const llm = createMockLLM('Explanation text.');
      const factory = new ExplainRoutingToolFactory(llm);
      const tool = factory.create();

      const result = await tool.execute(VALID_INPUT);

      const parsed = tool.outputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
