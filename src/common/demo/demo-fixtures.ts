import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Seed corpus fixture used by the keys-removed / DEMO_MODE path (NFR-OPS-4). Nodes that would call a
 * provider (extraction, classification) replay these instead, so a request completes with no key.
 */
export interface DemoFixture {
  sampleId: string | null;
  requestType: string | null;
  extractedFields: Record<string, unknown>;
  lineItemTexts: string[];
}

const CLEAN_FIXTURE_ID = 'rfq_01_catalog_clean';

let cache: DemoFixture[] | null = null;

/** Loads and caches the seed corpus fixtures from `src/database/seed/*.json` (relative to cwd, which
 * holds in dev and CI). Unparseable files or a missing directory yield an empty list rather than throwing. */
export function loadDemoFixtures(): DemoFixture[] {
  if (cache) return cache;

  const loaded: DemoFixture[] = [];
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
        const fields = (raw.extracted_fields ?? {}) as Record<string, unknown>;
        const meta = (raw._meta ?? {}) as Record<string, unknown>;
        const items = Array.isArray(fields.line_items) ? fields.line_items : [];
        loaded.push({
          sampleId: typeof meta.sample_id === 'string' ? meta.sample_id : null,
          requestType: typeof meta.request_type === 'string' ? meta.request_type : null,
          extractedFields: fields,
          lineItemTexts: items
            .map((entry) => String((entry as Record<string, unknown>)?.raw_text ?? ''))
            .filter((text) => text.length > 0),
        });
      } catch {
        // Skip an unparseable fixture rather than failing the whole demo path.
      }
    }
  } catch {
    // Seed directory unavailable — leave the list empty; callers surface a clear error.
  }

  cache = loaded;
  return loaded;
}

/** Picks the fixture whose line items best appear in `text`, defaulting to the clean catalog RFQ so
 * the demo path is deterministic. Returns null only when no fixtures are loaded. */
export function matchDemoFixture(text: string): DemoFixture | null {
  const fixtures = loadDemoFixtures();
  if (fixtures.length === 0) return null;

  const haystack = text.toLowerCase();
  let best = fixtures[0];
  let bestScore = -1;
  for (const fixture of fixtures) {
    const score = fixture.lineItemTexts.reduce<number>(
      (count, raw) => count + (haystack.includes(raw.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = fixture;
    }
  }

  if (bestScore <= 0) {
    return fixtures.find((fixture) => fixture.sampleId === CLEAN_FIXTURE_ID) ?? fixtures[0];
  }
  return best;
}
