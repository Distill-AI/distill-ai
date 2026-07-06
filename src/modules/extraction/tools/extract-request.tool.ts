import { Injectable } from '@nestjs/common';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';
import { matchDemoFixture } from '@common/demo/demo-fixtures';
import { LlmClientService } from '@modules/llm/llm-client.service';
import {
  ToolContract,
  type ToolCallContext,
} from '@modules/tools/interfaces/tool-contract.interface';
import {
  ExtractRequestInputSchema,
  ExtractionV1Schema,
  UNKNOWN_FIELD,
  type ExtractRequestInput,
  type ExtractionV1,
} from '../schemas/extraction-v1.schema';

@Injectable()
export class ExtractRequestToolFactory {
  constructor(private readonly llm: LlmClientService) {}

  create(): ToolContract<typeof ExtractRequestInputSchema, typeof ExtractionV1Schema> {
    return {
      toolName: 'extract_request',
      description:
        'Extract structured company, contact, line items, and dates from raw request text.',
      inputSchema: ExtractRequestInputSchema,
      outputSchema: ExtractionV1Schema,
      execute: (input: ExtractRequestInput, context?: ToolCallContext): Promise<ExtractionV1> =>
        this.execute(input, context),
    };
  }

  private async execute(
    input: ExtractRequestInput,
    context?: ToolCallContext,
  ): Promise<ExtractionV1> {
    // Keys-removed path (NFR-OPS-4): in DEMO_MODE replay the seeded extraction fixture instead of
    // calling the LLM, so extraction completes with no provider key. LlmClientService hard-requires
    // a key, so without this the whole keys-removed run would escalate at extraction.
    if (env.DEMO_MODE) {
      return this.extractFromFixture(input.text);
    }

    const prompt = this.buildPrompt(input);
    const completion = await this.llm.createChatCompletion(
      {
        model: env.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
      },
      {
        orgId: context?.orgId ?? '',
        requestId: context?.requestId ?? '',
        node: 'extract',
        // requestType intentionally omitted: extraction runs before classification, so the
        // request's actual type isn't known yet here. Falls back to createChatCompletion's own
        // default fixture selection, same as explain_routing/draft_clarification/draft_quote_email.
      },
    );
    const text = completion.choices[0]?.message?.content ?? '';

    const wrapped = text.match(/^\s*```(?:json)?\s*([\s\S]*)\s*```\s*$/i);
    const cleaned = (wrapped ? wrapped[1] : text).trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(SYS_MSG.EXTRACTION_JSON_PARSE_FAILED(detail));
    }

    return ExtractionV1Schema.parse(parsed);
  }

  /** Maps the best-matching seed fixture's `extracted_fields` into the extraction shape so the result
   * reconciles against the source text; defaults to the clean catalog RFQ.
   *
   * Line items always come from the fixture (pricing needs them), but the sender identity fields are
   * only replayed when the submitted text is genuinely this fixture's message. reconcile() checks line
   * items and totals, not sender identity, so replaying a fixture's canned company/contact against an
   * improvised request whose items merely happened to match would stamp the wrong details onto the
   * quote; when the sender is not corroborated the identity fields are left null instead. */
  private extractFromFixture(text: string): ExtractionV1 {
    const fixture = matchDemoFixture(text);
    if (!fixture) throw new Error(SYS_MSG.EXTRACTION_DEMO_FIXTURE_UNAVAILABLE);

    const fields = fixture.extractedFields;
    const rawItems = Array.isArray(fields.line_items) ? fields.line_items : [];
    const senderMatches = this.fixtureSenderMatchesText(fields, text);
    return ExtractionV1Schema.parse({
      company: senderMatches ? (fields.sender_company ?? null) : null,
      contact: senderMatches ? (fields.sender_contact ?? null) : null,
      sender_address: senderMatches ? (fields.sender_address ?? null) : null,
      sender_email: senderMatches ? (fields.sender_email ?? null) : null,
      delivery_date: senderMatches ? (fields.delivery_date ?? null) : null,
      line_items: rawItems.map((entry, index) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        return {
          position: typeof item.position === 'number' ? item.position : index + 1,
          raw_text: String(item.raw_text ?? ''),
          quantity: Number(item.quantity ?? 0),
          unit: String(item.unit ?? UNKNOWN_FIELD),
        };
      }),
    });
  }

  /** True when the submitted text is genuinely this fixture's message, judged by its most specific
   * sender signals (email or company name) appearing verbatim. Guards against stamping a fixture's
   * canned sender onto a live request whose line items merely happened to match. */
  private fixtureSenderMatchesText(fields: Record<string, unknown>, text: string): boolean {
    const haystack = text.toLowerCase();
    const email = typeof fields.sender_email === 'string' ? fields.sender_email.toLowerCase() : '';
    const company =
      typeof fields.sender_company === 'string' ? fields.sender_company.toLowerCase() : '';
    return (
      (email !== '' && haystack.includes(email)) || (company !== '' && haystack.includes(company))
    );
  }

  private buildPrompt(input: ExtractRequestInput): string {
    const failureBlock =
      input.priorFailure !== null
        ? `\nPrevious attempt failed validation: ${input.priorFailure}\nCorrect the issues and return valid JSON only.\n`
        : '';

    return `${failureBlock}Extract structured fields from this inbound B2B request.
Use null for company or contact when the value cannot be mapped from the text. Use "${UNKNOWN_FIELD}" for unit when unknown. Never guess.
Return ONLY valid JSON with no markdown or prose.

Required shape:
{
  "company": "string or null",
  "contact": "string or null",
  "sender_address": "string or null (full postal address if present in the source text, otherwise null)",
  "sender_email": "email or null",
  "delivery_date": "YYYY-MM-DD or null",
  "line_items": [
    { "position": 1, "raw_text": "string", "quantity": number, "unit": "string" }
  ]
}

Source text:
${input.text}`;
  }
}

export function extractionModelName(): string {
  return env.LLM_MODEL;
}
