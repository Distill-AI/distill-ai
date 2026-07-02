/**
 * Keys-removed end-to-end smoke (NFR-OPS-4-CI).
 *
 * Proves the demo resilience guarantee rather than assuming it: with DEMO_MODE on and NO provider
 * keys present, drive a full request from ingest to an approved PDF entirely on fixtures, and assert
 * it completes. A missing fixture surfaces as a failed pipeline status here (a non-zero exit) rather
 * than a silent live call (EC-01); no external call is made in this mode, so the run is deterministic
 * and does not flake on provider availability (EC-02). SEC-01: the run asserts no provider secrets are
 * configured, confirming the system never depends on an embedded fallback key.
 *
 * Run against a booted API + worker: `pnpm smoke:keys-removed` (see SMOKE_API_URL / SMOKE_TIMEOUT_MS).
 */
const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const QUOTE_STATUSES = ['needs_review', 'priced', 'ready', 'sent'];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function fail(message: string): never {
  console.error(`[keys-removed-smoke] FAIL: ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`[keys-removed-smoke] ok: ${message}`);
}

async function main(): Promise<void> {
  // 1. Confirm the run is genuinely keys-removed (SEC-01) — no embedded/live provider credentials.
  if (process.env.DEMO_MODE !== 'true') fail('DEMO_MODE must be "true" so the pipeline replays fixtures');
  for (const key of ['LLM_API_KEY', 'EMBEDDINGS_API_KEY']) {
    if ((process.env[key] ?? '').trim() !== '') {
      fail(`${key} is set — this check must run with no provider keys to prove the fixture fallback`);
    }
  }
  ok('DEMO_MODE=true and no provider keys present');

  // 2. Ingest a request whose line items match the seeded catalog.
  const form = new FormData();
  form.set('source_subject', 'keys-removed CI smoke');
  form.set(
    'source_body',
    'Please quote 10x M8 Hex Bolt Zinc Plated and 20x M6 Flat Washer Zinc Plated',
  );
  const created = await fetch(`${BASE}/requests`, { method: 'POST', body: form });
  if (!created.ok) fail(`ingest returned HTTP ${created.status}`);
  const requestId = ((await created.json()) as { data?: { request_id?: string } })?.data?.request_id;
  if (!requestId) fail('ingest response did not include a request_id');
  ok(`ingested request ${requestId}`);

  // 3. Poll until the pipeline has produced a quote. A `failed` status means a fixture was missing or a
  //    live call was attempted with no key — surface it as a hard failure (EC-01).
  const deadline = Date.now() + TIMEOUT_MS;
  let status = '';
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/requests/${requestId}`);
    if (res.ok) {
      status = ((await res.json()) as { data?: { status?: string } })?.data?.status ?? '';
      if (QUOTE_STATUSES.includes(status)) break;
      if (status === 'failed') fail('pipeline reached "failed" — a fixture is missing or a live call was attempted');
    }
    await sleep(2_000);
  }
  if (!QUOTE_STATUSES.includes(status)) fail(`timed out waiting for a quote; last status "${status || 'unknown'}"`);
  ok(`pipeline produced a quote (status "${status}")`);

  // 4. Approve the quote and generate its PDF.
  const approve = await fetch(`${BASE}/requests/${requestId}/quote`, { method: 'POST' });
  if (!approve.ok) fail(`approve returned HTTP ${approve.status}`);
  ok('quote approved and PDF generated');

  // 5. Download the PDF and assert it is a real, non-empty PDF.
  const pdf = await fetch(`${BASE}/requests/${requestId}/quote/pdf`);
  if (!pdf.ok) fail(`PDF download returned HTTP ${pdf.status}`);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  if (bytes.length < 100 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    fail(`downloaded file is not a PDF (${bytes.length} bytes)`);
  }
  ok(`downloaded approved PDF (${bytes.length} bytes, %PDF header)`);

  console.log(
    '[keys-removed-smoke] PASS: full ingest -> approved PDF completed on fixtures with no provider keys',
  );
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
