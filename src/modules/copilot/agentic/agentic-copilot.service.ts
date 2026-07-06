import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { GraphRecursionError } from '@langchain/langgraph';
import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
  type MessageContent,
} from '@langchain/core/messages';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { ToolRegistry } from '@modules/tools/registry';
import type { Request } from '@modules/requests/entities/request.entity';
import { aggregatePolicyFlags, buildExplainRoutingInput } from '../copilot.utils';
import { buildAgenticCopilotTools } from './agentic-copilot.tools';

export interface AskCopilotTraceStep {
  thought: string;
  tool: string | null;
  input: unknown;
  output: unknown;
}

export interface AskCopilotResult {
  answer: string;
  trace: AskCopilotTraceStep[];
}

const DEMO_FIXTURE_PATH = path.resolve(
  process.cwd(),
  'src/modules/copilot/agentic/fixtures/agentic-copilot-demo.json',
);

function contentToText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const block = part as unknown as Record<string, unknown>;
        return block.type === 'text' && typeof block.text === 'string' ? block.text : '';
      })
      .join('');
  }
  return '';
}

function toAskResult(messages: BaseMessage[]): AskCopilotResult {
  const trace: AskCopilotTraceStep[] = [];
  const stepByToolCallId = new Map<string, AskCopilotTraceStep>();
  let answer = '';

  for (const message of messages) {
    if (message instanceof AIMessage) {
      const toolCalls = message.tool_calls ?? [];
      const thought = contentToText(message.content);

      if (toolCalls.length === 0) {
        if (thought) {
          trace.push({ thought, tool: null, input: null, output: null });
          answer = thought;
        }
        continue;
      }

      for (const call of toolCalls) {
        const step: AskCopilotTraceStep = {
          thought,
          tool: call.name,
          input: call.args,
          output: null,
        };
        trace.push(step);
        if (call.id) stepByToolCallId.set(call.id, step);
      }
    } else if (message instanceof ToolMessage) {
      const step = message.tool_call_id ? stepByToolCallId.get(message.tool_call_id) : undefined;
      if (step) step.output = contentToText(message.content);
    }
  }

  return { answer, trace };
}

@Injectable()
export class AgenticCopilotService {
  private readonly logger = new Logger(AgenticCopilotService.name);
  private model?: ChatOpenAI;

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly lineItems: LineItemModelAction,
  ) {}

  /** Answers a free-text question about a request via a bounded ReAct loop over search_catalog and
   * explain_routing; 404s if the feature is disabled, replays a fixture in demo mode. */
  async ask(request: Request, question: string): Promise<AskCopilotResult> {
    if (!env.AGENTIC_COPILOT_ENABLED) {
      throw new CustomHttpException(SYS_MSG.AGENTIC_COPILOT_DISABLED, HttpStatus.NOT_FOUND);
    }

    if (env.DEMO_MODE) {
      return this.loadDemoFixture();
    }

    const policyFlags = await aggregatePolicyFlags(this.lineItems, request.id);
    const tools = buildAgenticCopilotTools(this.toolRegistry, {
      requestId: request.id,
      orgId: request.org_id,
      explainRoutingInput: buildExplainRoutingInput(request, policyFlags),
    });

    // The model client is built once and reused; the graph is rebuilt per request because its
    // tools are closures bound to this request's org/routing context (see agentic-copilot.tools.ts).
    const agent = createAgent({ model: this.getModel(), tools });

    try {
      const result = await agent.invoke(
        { messages: [{ role: 'user', content: question }] },
        { recursionLimit: env.AGENTIC_COPILOT_MAX_STEPS },
      );
      return toAskResult(result.messages);
    } catch (err) {
      if (err instanceof GraphRecursionError) {
        return { answer: SYS_MSG.AGENTIC_COPILOT_MAX_STEPS_EXCEEDED, trace: [] };
      }
      throw err;
    }
  }

  private getModel(): ChatOpenAI {
    if (!this.model) {
      this.model = new ChatOpenAI({
        apiKey: env.LLM_API_KEY,
        configuration: { baseURL: env.LLM_BASE_URL },
        model: env.LLM_MODEL,
      });
    }
    return this.model;
  }

  private loadDemoFixture(): AskCopilotResult {
    try {
      const raw = fs.readFileSync(DEMO_FIXTURE_PATH, 'utf8');
      return JSON.parse(raw) as AskCopilotResult;
    } catch (err) {
      this.logger.error(
        `Failed to load agentic copilot demo fixture: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { answer: '', trace: [] };
    }
  }
}
