import { HttpStatus } from '@nestjs/common';
import { vi, type Mock } from 'vitest';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { GraphRecursionError } from '@langchain/langgraph';
import * as SYS_MSG from '@constants/system-messages';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { ToolRegistry } from '@modules/tools/registry';

vi.mock('@config/env', () => ({
  env: {
    AGENTIC_COPILOT_ENABLED: true,
    AGENTIC_COPILOT_MAX_STEPS: 4,
    DEMO_MODE: false,
    LLM_API_KEY: 'test-key',
    LLM_BASE_URL: 'http://localhost:11434/v1',
    LLM_MODEL: 'qwen-72b',
  },
}));

const invokeAgentMock = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() => vi.fn(() => ({ invoke: invokeAgentMock })));

vi.mock('langchain', () => ({ createAgent: createAgentMock }));
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    __isChatOpenAI = true;
    constructor(public opts: unknown) {}
  },
}));

const buildToolsMock = vi.hoisted(() =>
  vi.fn(() => ['search_catalog-tool', 'explain_routing-tool']),
);
vi.mock('../agentic/agentic-copilot.tools', () => ({
  buildAgenticCopilotTools: buildToolsMock,
}));

import { AgenticCopilotService } from '../agentic/agentic-copilot.service';
import { env } from '@config/env';

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: 'req-1',
    org_id: 'org-1',
    routing: RequestRouting.NEEDS_REVIEW,
    overall_confidence: 0.68,
    routing_reasons: [],
    ...overrides,
  } as Request;
}

function makeLineItems(): LineItemModelAction {
  return {
    list: vi.fn().mockResolvedValue({ payload: [], paginationMeta: { total: 0 } }),
  } as unknown as LineItemModelAction;
}

function makeToolRegistry(): ToolRegistry {
  return { invoke: vi.fn() } as unknown as ToolRegistry;
}

describe('AgenticCopilotService', () => {
  beforeEach(() => {
    env.AGENTIC_COPILOT_ENABLED = true;
    env.DEMO_MODE = false;
    invokeAgentMock.mockReset();
    createAgentMock.mockClear();
    buildToolsMock.mockClear();
  });

  it('throws a 404 before touching the LLM when the feature is disabled', async () => {
    env.AGENTIC_COPILOT_ENABLED = false;
    const service = new AgenticCopilotService(makeToolRegistry(), makeLineItems());

    await expect(service.ask(buildRequest(), 'why is this flagged?')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    expect(createAgentMock).not.toHaveBeenCalled();
  });

  it('returns the demo fixture without instantiating the agent when DEMO_MODE is on', async () => {
    env.DEMO_MODE = true;
    const service = new AgenticCopilotService(makeToolRegistry(), makeLineItems());

    const result = await service.ask(buildRequest(), 'why is this flagged?');

    expect(createAgentMock).not.toHaveBeenCalled();
    expect(typeof result.answer).toBe('string');
    expect(result.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(result.trace)).toBe(true);
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it('runs the agent and maps its message list into an answer and a step trace', async () => {
    invokeAgentMock.mockResolvedValue({
      messages: [
        new HumanMessage('why is this flagged?'),
        new AIMessage({
          content: 'Let me check the routing explanation.',
          tool_calls: [{ id: 'call_1', name: 'explain_routing', args: {} }],
        }),
        new ToolMessage({
          content: JSON.stringify({ explanation: 'Confidence below threshold.', degraded: false }),
          tool_call_id: 'call_1',
        }),
        new AIMessage({ content: 'This needs review because confidence is below threshold.' }),
      ],
    });

    const toolRegistry = makeToolRegistry();
    const lineItems = makeLineItems();
    const service = new AgenticCopilotService(toolRegistry, lineItems);
    const request = buildRequest();

    const result = await service.ask(request, 'why is this flagged?');

    expect(buildToolsMock).toHaveBeenCalledWith(toolRegistry, {
      requestId: request.id,
      orgId: request.org_id,
      explainRoutingInput: {
        routing: RequestRouting.NEEDS_REVIEW,
        overallConfidence: 0.68,
        routingReasons: [],
        policyFlags: [],
      },
    });
    expect(createAgentMock).toHaveBeenCalledWith({
      model: expect.objectContaining({ __isChatOpenAI: true }),
      tools: ['search_catalog-tool', 'explain_routing-tool'],
    });
    expect(invokeAgentMock).toHaveBeenCalledWith(
      { messages: [{ role: 'user', content: 'why is this flagged?' }] },
      { recursionLimit: 4 },
    );

    expect(result.answer).toBe('This needs review because confidence is below threshold.');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]).toMatchObject({ tool: 'explain_routing', input: {} });
    expect(result.trace[0].output).toContain('Confidence below threshold');
    expect(result.trace[1]).toMatchObject({
      tool: null,
      thought: 'This needs review because confidence is below threshold.',
    });
  });

  it('reuses the same model instance across two asks instead of rebuilding it', async () => {
    invokeAgentMock.mockResolvedValue({ messages: [new AIMessage({ content: 'ok' })] });
    const service = new AgenticCopilotService(makeToolRegistry(), makeLineItems());

    await service.ask(buildRequest(), 'first question');
    await service.ask(buildRequest(), 'second question');

    const [firstCall, secondCall] = createAgentMock.mock.calls as Array<[{ model: unknown }]>;
    expect(firstCall[0].model).toBe(secondCall[0].model);
  });

  it('returns a graceful max-steps-exceeded message instead of throwing when the recursion limit is hit', async () => {
    invokeAgentMock.mockRejectedValue(new GraphRecursionError('recursion limit reached'));
    const service = new AgenticCopilotService(makeToolRegistry(), makeLineItems());

    const result = await service.ask(buildRequest(), 'why is this flagged?');

    expect(result).toEqual({ answer: SYS_MSG.AGENTIC_COPILOT_MAX_STEPS_EXCEEDED, trace: [] });
  });

  it('rethrows an unexpected agent invocation error rather than swallowing it', async () => {
    const boom = new Error('boom');
    invokeAgentMock.mockRejectedValue(boom);
    const service = new AgenticCopilotService(makeToolRegistry(), makeLineItems());

    await expect(service.ask(buildRequest(), 'why is this flagged?')).rejects.toBe(boom);
  });

  it('excludes close_tie and manual_override from the explain_routing tool context, matching CopilotService', async () => {
    invokeAgentMock.mockResolvedValue({ messages: [new AIMessage({ content: 'ok' })] });
    const lineItems = {
      list: vi.fn().mockResolvedValue({
        payload: [
          { id: 'li-1', flags: ['close_tie'] },
          { id: 'li-2', flags: ['pricing_blocked', 'manual_override'] },
        ],
        paginationMeta: { total: 2 },
      }),
    } as unknown as LineItemModelAction;
    const service = new AgenticCopilotService(makeToolRegistry(), lineItems);

    await service.ask(buildRequest(), 'why is this flagged?');

    const [, ctx] = (buildToolsMock as unknown as Mock).mock.calls[0] as [
      unknown,
      { explainRoutingInput: { policyFlags: string[] } },
    ];
    expect(ctx.explainRoutingInput.policyFlags).toEqual(['pricing_blocked']);
  });
});
