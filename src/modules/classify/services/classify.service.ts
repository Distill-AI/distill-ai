import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { env } from '@config/env';
import { matchDemoFixture } from '@common/demo/demo-fixtures';
import { LlmClientService } from '@modules/llm/llm-client.service';
import { CircuitBreakerOpenError } from '@modules/pipeline/pipeline.errors';
import * as SYS_MSG from '@constants/system-messages';

// Confidence for a deterministic DEMO_MODE fixture match. Above CLASSIFY_THRESHOLD so it is not
// treated as low-confidence and defaulted.
const DEMO_CLASSIFY_CONFIDENCE = 0.95;

const llmResponseSchema = z.object({
  type: z.enum(['catalog_rfq', 'service_quote']),
  confidence: z.number().min(0).max(1),
});

export interface ParsedRequestInput {
  company: string;
  contact: string;
  description: string;
  lineItems?: {
    raw_text: string;
    position: number;
    quantity?: number | null;
    unit?: string | null;
  }[];
}

export interface ClassifyResult {
  type: 'catalog_rfq' | 'service_quote';
  confidence: number;
}

@Injectable()
export class ClassifyService {
  private readonly logger = new Logger(ClassifyService.name);

  constructor(private readonly llm: LlmClientService) {}

  async classify(
    parsedRequest: ParsedRequestInput,
    context: { orgId: string; requestId: string },
  ): Promise<ClassifyResult> {
    const description = parsedRequest.description.trim();
    const lineItems = (parsedRequest.lineItems ?? []).filter((li) => li.raw_text.trim().length > 0);
    if (!description && lineItems.length === 0) {
      this.logger.warn(SYS_MSG.CLASSIFY_MALFORMED_INPUT);
      return { type: 'service_quote', confidence: 0 };
    }

    // Keys-removed path (NFR-OPS-4): in DEMO_MODE derive the type from the matching seed fixture
    // instead of calling the LLM (which hard-requires a key), so classification is fixture-accurate
    // rather than falling back to service_quote.
    if (env.DEMO_MODE) {
      return this.classifyFromFixture(description, lineItems);
    }

    const prompt = this.buildPrompt({ ...parsedRequest, description, lineItems });

    try {
      const completion = await this.llm.createChatCompletion(
        {
          model: env.LLM_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 100,
        },
        { ...context, node: 'classify' },
      );

      const text = completion.choices[0]?.message?.content ?? '';
      const cleaned = text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*$/gm, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      const result = llmResponseSchema.parse(parsed);
      const threshold = env.CLASSIFY_THRESHOLD;

      if (result.confidence < threshold) {
        this.logger.warn(SYS_MSG.CLASSIFY_DEFAULTED_LOW_CONFIDENCE(result.confidence, threshold));
        return { type: 'service_quote', confidence: result.confidence };
      }

      return result;
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) throw err;
      this.logger.error(SYS_MSG.CLASSIFY_RETRY_FAILED);
      return { type: 'service_quote', confidence: 0 };
    }
  }

  private classifyFromFixture(
    description: string,
    lineItems: NonNullable<ParsedRequestInput['lineItems']>,
  ): ClassifyResult {
    const haystack = [description, ...lineItems.map((li) => li.raw_text)].join('\n');
    const fixture = matchDemoFixture(haystack);
    // Fail loudly on an empty fixture corpus (EC-01), consistent with the extraction tool, rather than
    // silently defaulting every keys-removed request to catalog_rfq.
    if (!fixture) {
      throw new Error(SYS_MSG.CLASSIFY_DEMO_FIXTURE_UNAVAILABLE);
    }
    const type = fixture.requestType === 'service_quote' ? 'service_quote' : 'catalog_rfq';
    return { type, confidence: DEMO_CLASSIFY_CONFIDENCE };
  }

  private buildPrompt(parsedRequest: ParsedRequestInput): string {
    return `Classify this request as either "catalog_rfq" (discrete parts, products, components) or "service_quote" (scoped job, consulting, labor).
Company: ${parsedRequest.company}
Description: ${parsedRequest.description}
Line Items: ${(parsedRequest.lineItems ?? []).map((li) => li.raw_text).join('\n') || 'none'}
Return ONLY valid JSON with no markdown formatting or prose. Example: {"type": "catalog_rfq", "confidence": 0.95}`;
  }
}
