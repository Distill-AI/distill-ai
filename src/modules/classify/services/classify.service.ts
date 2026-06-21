import { Injectable, Logger } from '@nestjs/common';
import { env } from '@config/env';
import { LLMProvider } from '@modules/llm/llm.provider';
import * as SYS_MSG from '@constants/system-messages';

export interface ParsedRequestInput {
  company: string;
  contact: string;
  description: string;
  lineItems?: unknown[];
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
    if (
      !parsedRequest.description &&
      (!parsedRequest.lineItems || parsedRequest.lineItems.length === 0)
    ) {
      this.logger.warn(SYS_MSG.CLASSIFY_MALFORMED_INPUT);
      return { type: 'service_quote', confidence: 0 };
    }

    const prompt = this.buildPrompt(parsedRequest);

    try {
      return await this.invokeWithRetry(prompt);
    } catch {
      this.logger.error(SYS_MSG.CLASSIFY_RETRY_FAILED);
      return { type: 'service_quote', confidence: 0 };
    }
  }

  private async invokeWithRetry(prompt: string, attempt = 1): Promise<ClassifyResult> {
    try {
      const response = await this.llm.invoke({
        prompt,
        temperature: 0.2,
        maxTokens: 100,
      });

      const result = JSON.parse(response.text) as { type: string; confidence: number };
      const threshold = env.CLASSIFY_THRESHOLD;

      if (result.confidence < threshold) {
        this.logger.warn(SYS_MSG.CLASSIFY_DEFAULTED_LOW_CONFIDENCE(result.confidence, threshold));
        return { type: 'service_quote', confidence: result.confidence };
      }

      return {
        type: result.type === 'catalog_rfq' ? 'catalog_rfq' : 'service_quote',
        confidence: result.confidence,
      };
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
Line Items: ${JSON.stringify(parsedRequest.lineItems || [])}
Respond with JSON: { "type": "catalog_rfq" | "service_quote", "confidence": 0.0-1.0 }`;
  }
}
