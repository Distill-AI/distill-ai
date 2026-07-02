import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import * as SYS_MSG from '@constants/system-messages';
import { LLMProvider } from '@modules/llm/llm.provider';
import { ToolContract } from '@modules/tools/interfaces/tool-contract.interface';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { RoutingReasonCode } from '../enums/routing-reason-code.enum';
export const ExplainRoutingInputSchema = z.object({
  routing: z.nativeEnum(RequestRouting),
  overallConfidence: z.number().min(0).max(1),
  routingReasons: z.array(
    z.object({
      code: z.nativeEnum(RoutingReasonCode),
      message: z.string(),
      source: z.enum(['extraction', 'confidence', 'policy']),
    }),
  ),
  policyFlags: z.array(z.string()).optional().default([]),
});

export const ExplainRoutingOutputSchema = z.object({
  explanation: z.string().min(1),
  degraded: z.boolean(),
});

export type ExplainRoutingInput = z.infer<typeof ExplainRoutingInputSchema>;
export type ExplainRoutingOutput = z.infer<typeof ExplainRoutingOutputSchema>;

const ROUTING_REASON_MAP: Partial<Record<RoutingReasonCode, () => string>> = {
  [RoutingReasonCode.INCOMPLETE_DEAL_VALUE]: () => SYS_MSG.EXPLAIN_ROUTING_DEAL_VALUE_INCOMPLETE,
  [RoutingReasonCode.NO_LINE_ITEMS]: () => SYS_MSG.EXPLAIN_ROUTING_NO_LINE_ITEMS,
  [RoutingReasonCode.EXTRACTION_FAILED]: () => SYS_MSG.EXPLAIN_ROUTING_EXTRACTION_FAILED,
  [RoutingReasonCode.EXTRACTION_EMPTY_SOURCE]: () => SYS_MSG.EXPLAIN_ROUTING_EXTRACTION_FAILED,
  [RoutingReasonCode.AUTO_ELIGIBLE]: () => SYS_MSG.EXPLAIN_ROUTING_ALL_CLEAR,
};

@Injectable()
export class ExplainRoutingToolFactory {
  private readonly logger = new Logger(ExplainRoutingToolFactory.name);

  constructor(private readonly llm: LLMProvider) {}

  create(): ToolContract<typeof ExplainRoutingInputSchema, typeof ExplainRoutingOutputSchema> {
    return {
      toolName: 'explain_routing',
      description:
        'Generates a plain-English explanation of why a quote was routed to auto-eligible or needs-review, based on its routing reasons and policy flags. Read-only advisory tool.',
      inputSchema: ExplainRoutingInputSchema,
      outputSchema: ExplainRoutingOutputSchema,
      execute: (input: ExplainRoutingInput): Promise<ExplainRoutingOutput> => this.execute(input),
    };
  }

  private async execute(input: ExplainRoutingInput): Promise<ExplainRoutingOutput> {
    try {
      const prompt = this.buildPrompt(input);
      const response = await this.llm.invoke({ prompt, temperature: 0.3, maxTokens: 300 });
      const text = response?.text?.trim();
      if (text && text.length > 0) {
        return { explanation: text, degraded: false };
      }
    } catch (err) {
      this.logger.warn(
        `LLM unavailable for explain_routing; using fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { explanation: this.buildFallbackExplanation(input), degraded: true };
  }

  private buildPrompt(input: ExplainRoutingInput): string {
    const lines: string[] = [
      'You are a helpful B2B quote analyst. Explain in plain English why this quote was routed the way it was.',
      '',
      `Routing decision: ${input.routing}`,
      `Overall confidence: ${(input.overallConfidence * 100).toFixed(0)}%`,
      '',
      'Routing reasons:',
    ];

    for (const reason of input.routingReasons) {
      lines.push(`- [${reason.source}] ${reason.code}: ${reason.message}`);
    }

    if (input.policyFlags.length > 0) {
      lines.push('', 'Policy flags on line items:', ...input.policyFlags.map((f) => `- ${f}`));
    }

    lines.push(
      '',
      'Write 2-3 concise sentences in plain English suitable for an estimator who is not familiar with internal routing codes. Do not use markdown or bullet points. Just a single paragraph.',
    );

    return lines.join('\n');
  }

  private buildFallbackExplanation(input: ExplainRoutingInput): string {
    const { routing, routingReasons, policyFlags } = input;

    if (routing === RequestRouting.AUTO_ELIGIBLE && routingReasons.length === 0) {
      return SYS_MSG.EXPLAIN_ROUTING_ALL_CLEAR;
    }

    const parts: string[] = [];

    if (routing === RequestRouting.NEEDS_REVIEW) {
      parts.push(SYS_MSG.EXPLAIN_ROUTING_REVIEW_REQUIRED);
    }

    for (const reason of routingReasons) {
      const code = reason.code;
      const factory = ROUTING_REASON_MAP[code];
      if (factory) {
        parts.push(factory());
      } else {
        parts.push(reason.message);
      }
    }

    if (policyFlags.length > 0) {
      parts.push(SYS_MSG.EXPLAIN_ROUTING_POLICY_FLAGS(policyFlags.length));
    }

    return parts.join(' ');
  }
}
