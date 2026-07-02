# Demo Checklist

Run-of-show checks to complete **before the camera is on**. The centrepiece is the keys-removed run:
proof that a full request completes from ingest to an approved PDF on fixtures alone, so the demo does
not depend on any live provider being reachable.

## Keys-removed run (NFR-OPS-4-CI)

This is the resilience guarantee we demo against: with `DEMO_MODE=true` and **no provider keys**, the
pipeline replays LLM fixtures and falls back to trigram catalog matching, so it never makes an external
call. The `keys-removed-e2e` CI job runs this on every PR to `dev`/`staging`/`main`; run it locally too
before a demo.

### What it proves

- One request goes ingest → priced quote → approved → PDF with **no `LLM_API_KEY` / `EMBEDDINGS_API_KEY`** set (AC-01, SEC-01).
- A missing fixture surfaces as a failed pipeline status (non-zero exit), never a silent live call (EC-01).
- It is deterministic — no external call is made, so it does not flake on provider availability (EC-02).

### Run it locally

1. Bring up Postgres (pgvector) and Redis:

   ```bash
   docker compose up -d postgres redis
   ```

2. Seed the schema, demo org, SKU catalog, and pricing rules (all via migrations):

   ```bash
   pnpm build
   pnpm migration:run
   ```

3. Start the worker and API in **keys-removed** mode (a separate terminal for each). Note there is no
   `LLM_API_KEY` on these commands — that is the point:

   ```bash
   DEMO_MODE=true pnpm worker:prod
   DEMO_MODE=true pnpm start:prod
   ```

4. Run the end-to-end check once the API is healthy (`GET /api/v1/health` returns `200`):

   ```bash
   DEMO_MODE=true pnpm smoke:keys-removed
   ```

   Expected: the script prints each step and exits `0`:

   ```
   [keys-removed-smoke] ok: DEMO_MODE=true and no provider keys present
   [keys-removed-smoke] ok: ingested request <id>
   [keys-removed-smoke] ok: pipeline produced a quote (status "needs_review")
   [keys-removed-smoke] ok: quote approved and PDF generated
   [keys-removed-smoke] ok: downloaded approved PDF (<n> bytes, %PDF header)
   [keys-removed-smoke] PASS: full ingest -> approved PDF completed on fixtures with no provider keys
   ```

   A non-zero exit means the fixture path is broken — fix it before demoing. `SMOKE_API_URL` and
   `SMOKE_TIMEOUT_MS` override the target and the wait budget.

### In CI

The `keys-removed-e2e` job (`.github/workflows/ci.yml`) spins up Postgres + Redis with **no provider
secrets in its environment**, runs the migrations, boots the worker + API in `DEMO_MODE`, and runs
`pnpm smoke:keys-removed`. Because no secrets are present, any accidental dependence on a live key (or a
missing fixture) fails the job instead of passing quietly.

## Pre-demo sanity checks

- [ ] `docker compose up -d postgres redis` — both containers healthy.
- [ ] `pnpm migration:run` — no pending migrations; catalog + pricing rules seeded.
- [ ] Worker and API start cleanly in `DEMO_MODE` with no provider keys.
- [ ] `pnpm smoke:keys-removed` passes (ingest → approved PDF on fixtures).
- [ ] The generated PDF opens and shows the expected line items.
