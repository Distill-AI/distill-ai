import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';
import { LLMProvider } from '@modules/llm/llm.provider';
import { ToolContract } from '@modules/tools/interfaces/tool-contract.interface';
import {
  ExtractRequestInputSchema,
  ExtractionV1Schema,
  UNKNOWN_FIELD,
  type ExtractRequestInput,
  type ExtractionV1,
} from '../schemas/extraction-v1.schema';

const CLEAN_FIXTURE_ID = 'rfq_01_catalog_clean';

@Injectable()
export class ExtractRequestToolFactory {
  private demoFixtures: Record<string, unknown>[] | null = null;

  constructor(private readonly llm: LLMProvider) {}

  create(): ToolContract<typeof ExtractRequestInputSchema, typeof ExtractionV1Schema> {
    return {
      toolName: 'extract_request',
      description:
        'Extract structured company, contact, line items, and dates from raw request text.',
      inputSchema: ExtractRequestInputSchema,
      outputSchema: ExtractionV1Schema,
      execute: (input: ExtractRequestInput): Promise<ExtractionV1> => this.execute(input),
    };
  }

  private async execute(input: ExtractRequestInput): Promise<ExtractionV1> {
    // Keys-removed path (NFR-OPS-4): in DEMO_MODE replay the seeded extraction fixture instead of
    // calling the LLM, so extraction completes with no provider key. LLMProvider hard-requires a key,
    // so without this the whole keys-removed run would escalate at extraction.
    if (env.DEMO_MODE) {
      return this.extractFromFixture(input.text);
    }

    const prompt = this.buildPrompt(input);
    const response = await this.llm.invoke({
      prompt,
      temperature: 0.2,
      maxTokens: 1500,
    });

    const wrapped = response.text.match(/^\s*```(?:json)?\s*([\s\S]*)\s*```\s*$/i);
    const cleaned = (wrapped ? wrapped[1] : response.text).trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(SYS_MSG.EXTRACTION_JSON_PARSE_FAILED(detail));
    }

    return ExtractionV1Schema.parse(parsed);
  }

  /** Maps the best-matching seed fixture's `extracted_fields` into the extraction shape. Picks the
   * fixture whose line items appear in the source text so the result reconciles, defaulting to the
   * clean catalog RFQ. */
  private extractFromFixture(text: string): ExtractionV1 {
    const fields = this.pickFixture(text);
    if (!fields) throw new Error(SYS_MSG.EXTRACTION_DEMO_FIXTURE_UNAVAILABLE);

    const rawItems = Array.isArray(fields.line_items) ? fields.line_items : [];
    return ExtractionV1Schema.parse({
      company: fields.sender_company ?? null,
      contact: fields.sender_contact ?? null,
      sender_address: fields.sender_address ?? null,
      sender_email: fields.sender_email ?? null,
      delivery_date: fields.delivery_date ?? null,
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

  private pickFixture(text: string): Record<string, unknown> | null {
    const fixtures = this.loadDemoFixtures();
    if (fixtures.length === 0) return null;

    const haystack = text.toLowerCase();
    let best = fixtures[0];
    let bestScore = -1;
    for (const fixture of fixtures) {
      const items = Array.isArray(fixture.line_items) ? fixture.line_items : [];
      const score = items.reduce<number>((count, entry) => {
        const raw = String((entry as Record<string, unknown>)?.raw_text ?? '').toLowerCase();
        return count + (raw.length > 0 && haystack.includes(raw) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        best = fixture;
      }
    }

    // No line item matched the text — fall back to the clean catalog RFQ for a deterministic demo.
    if (bestScore <= 0) {
      return fixtures.find((f) => f.__sample_id === CLEAN_FIXTURE_ID) ?? fixtures[0];
    }
    return best;
  }

  private loadDemoFixtures(): Record<string, unknown>[] {
    if (this.demoFixtures) return this.demoFixtures;

    const loaded: Record<string, unknown>[] = [];
    try {
      const dir = path.resolve(process.cwd(), 'src/database/seed');
      const files = fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .sort();
      for (const file of files) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<
            string,
            unknown
          >;
          const fields = raw.extracted_fields;
          if (fields && typeof fields === 'object') {
            const meta = (raw._meta ?? {}) as Record<string, unknown>;
            loaded.push({ ...(fields as Record<string, unknown>), __sample_id: meta.sample_id });
          }
        } catch {
          // Skip an unparseable fixture rather than failing the whole demo path.
        }
      }
    } catch {
      // Seed directory unavailable — leave the list empty; extractFromFixture surfaces a clear error.
    }

    this.demoFixtures = loaded;
    return loaded;
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
