import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';
import { LlmClientService } from '@modules/llm/llm-client.service';
import {
  ToolContract,
  type ToolCallContext,
} from '@modules/tools/interfaces/tool-contract.interface';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { HttpStatus } from '@nestjs/common';

export const DraftClarificationInputSchema = z.object({
  gaps: z
    .array(z.string().trim().min(1, 'Gap cannot be empty'))
    .min(1, 'At least one gap is required'),
  requestId: z.string().uuid(),
});
export const DraftClarificationOutputSchema = z.object({
  draft_subject: z.string().min(1),
  draft_body: z.string().min(1),
});

export type DraftClarificationInput = z.infer<typeof DraftClarificationInputSchema>;
export type DraftClarificationOutput = z.infer<typeof DraftClarificationOutputSchema>;

@Injectable()
export class DraftClarificationToolFactory {
  constructor(private readonly llm: LlmClientService) {}

  create(): ToolContract<
    typeof DraftClarificationInputSchema,
    typeof DraftClarificationOutputSchema
  > {
    return {
      toolName: 'draft_clarification',
      description:
        'Generates a clarification email draft listing each detected information gap as a plain-English bullet.',
      inputSchema: DraftClarificationInputSchema,
      outputSchema: DraftClarificationOutputSchema,
      execute: (
        input: DraftClarificationInput,
        context?: ToolCallContext,
      ): Promise<DraftClarificationOutput> => this.execute(input, context),
    };
  }

  private async execute(
    input: DraftClarificationInput,
    context?: ToolCallContext,
  ): Promise<DraftClarificationOutput> {
    const prompt = this.buildPrompt(input.gaps);
    const completion = await this.llm.createChatCompletion(
      {
        model: env.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        orgId: context?.orgId ?? '',
        requestId: context?.requestId ?? '',
        node: 'draft_clarification',
      },
    );

    try {
      const raw = completion.choices[0]?.message?.content;
      const text = typeof raw === 'string' ? raw.trim() : '';
      const wrapped = text.match(/^\s*```(?:json)?\s*([\s\S]*)\s*```\s*$/i);
      const cleaned = (wrapped ? wrapped[1] : text).trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      return DraftClarificationOutputSchema.parse(parsed);
    } catch {
      throw new CustomHttpException(
        SYS_MSG.CLARIFICATION_DRAFT_PARSE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private buildPrompt(gaps: string[]): string {
    const bulletList = gaps.map((g) => `- ${g}`).join('\n');
    return `Generate a clarification email for a B2B quote request that has missing information.

The following information gaps were detected:
${bulletList}

Return ONLY valid JSON with no markdown or prose:
{
  "draft_subject": "A concise subject line requesting clarification",
  "draft_body": "A professional email body listing each gap as a bullet point, requesting the customer to provide the missing details."
}

The email should be polite and professional. Address the customer directly and list each missing item clearly.`;
  }
}
