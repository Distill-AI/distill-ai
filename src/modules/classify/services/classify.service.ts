import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { env } from '@config/env';
import { matchDemoFixture } from '@common/demo/demo-fixtures';
import { LLMProvider } from '@modules/llm/llm.provider';
import * as SYS_MSG from '@constants/system-messages';

// Confidence for a deterministic DEMO_MODE fixture match — above CLASSIFY_THRESHOLD so it is not
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

  constructor(private readonly llm: LLMProvider) {}

  async classify(parsedRequest: ParsedRequestInput): Promise<ClassifyResult> {
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
      return await this.invokeWithRetry(prompt);
    } catch {
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
    const type = fixture?.requestType === 'service_quote' ? 'service_quote' : 'catalog_rfq';
    return { type, confidence: DEMO_CLASSIFY_CONFIDENCE };
  }

  private async invokeWithRetry(prompt: string, attempt = 1): Promise<ClassifyResult> {
    try {
      const response = await this.llm.invoke({
        prompt,
        temperature: 0.2,
        maxTokens: 100,
      });

      const cleaned = response.text
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
      if (attempt < 2) {
        this.logger.warn(`Classification attempt ${attempt} failed; retrying...`);
        return this.invokeWithRetry(prompt, attempt + 1);
      }
      throw err;
    }
  }

  private buildPrompt(parsedRequest: ParsedRequestInput): string {
    return `Classify this request as either "catalog_rfq" (discrete parts, products, components) or "service_quote" (scoped job, consulting, labor).
Company: ${parsedRequest.company}
Description: ${parsedRequest.description}
Line Items: ${(parsedRequest.lineItems ?? []).map((li) => li.raw_text).join('\n') || 'none'}
Return ONLY valid JSON with no markdown formatting or prose. Example: {"type": "catalog_rfq", "confidence": 0.95}`;
  }
}
