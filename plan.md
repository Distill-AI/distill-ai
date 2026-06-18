# Plan — US-E8-3 Database Schema Migrations

Tickets in scope: **US-E8-3-T1** (core tables), **US-E8-3-T2** (pipeline columns on requests),
**US-E8-3-T3** (tool_calls table). All land in one PR.

---

## File inventory — 17 new files, 0 modified

### Entities (14 new files)

| # | File | Extends | Notes |
| --- | --- | --- | --- |
| 1 | `src/modules/organizations/entities/organization.entity.ts` | `BaseEntity` | |
| 2 | `src/modules/users/entities/user.entity.ts` | `BaseEntity` | CITEXT email handled in migration |
| 3 | `src/modules/requests/entities/request.entity.ts` | `BaseEntity` | Pipeline columns added in T2 migration |
| 4 | `src/modules/requests/entities/attachment.entity.ts` | — | No `updated_at`; only `created_at` |
| 5 | `src/modules/extraction/entities/extraction.entity.ts` | — | No `updated_at` |
| 6 | `src/modules/catalog/entities/sku.entity.ts` | `BaseEntity` | `embedding` typed `text` in TS; migration creates `VECTOR(384)` |
| 7 | `src/modules/catalog/entities/line-item.entity.ts` | — | No `updated_at` |
| 8 | `src/modules/catalog/entities/candidate-match.entity.ts` | — | No timestamps |
| 9 | `src/modules/pricing/entities/pricing-rule.entity.ts` | `BaseEntity` | |
| 10 | `src/modules/quotes/entities/quote.entity.ts` | `BaseEntity` | |
| 11 | `src/modules/quotes/entities/quote-line-item.entity.ts` | — | No timestamps |
| 12 | `src/modules/clarification/entities/clarification.entity.ts` | — | Only `created_at` |
| 13 | `src/modules/tools/entities/tool-call.entity.ts` | — | Only `created_at`; UUID PK; `@Index()` for composite index |
| 14 | `src/modules/events/entities/audit-event.entity.ts` | — | `bigint` PK (not UUID); only `created_at` |

### Migrations (3 new files)

| # | File | Ticket | Method | Reason |
| --- | --- | --- | --- | --- |
| 15 | `src/database/migrations/0001_CreateCoreBusinessTables.ts` | T1 | **Hand-written** | Requires `CREATE EXTENSION`, `VECTOR(384)`, `CITEXT`, `bigint` identity PK, `REVOKE` |
| 16 | `src/database/migrations/0002_AddRequestPipelineColumns.ts` | T2 | **Hand-written** | Requires partial index (`WHERE status = 'parsing'`) — TypeORM `@Index()` has no `WHERE` support |
| 17 | `src/database/migrations/0003_CreateToolCallsTable.ts` | T3 | **Generated** | Standard table + `@Index()` composite index; TypeORM generates this cleanly |

---

## Migration workflow

### Hand-written migrations (0001 and 0002)

Use `migration:create` to scaffold the empty `MigrationInterface` class, then fill in
`up()` and `down()` with the SQL:

```sh
pnpm migration:create src/database/migrations/0001_CreateCoreBusinessTables
pnpm migration:create src/database/migrations/0002_AddRequestPipelineColumns
```

Each command creates a timestamped file with this boilerplate:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class 0001CreateCoreBusinessTables1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(queryRunner: QueryRunner): Promise<void> {}
}
```

Write the SQL into `up()` and `down()` by hand. Apply when ready:

```sh
pnpm migration:run
```

### Generated migration (0003)

Apply 0001 and 0002 first so the DB has all T1+T2 tables, then generate 0003 from the
`ToolCall` entity diff:

```sh
pnpm migration:generate src/database/migrations/0003_CreateToolCallsTable
pnpm migration:run
```

The generated file needs no manual edits — the `@Index()` decorator on `ToolCall` produces
the `(request_id, created_at)` composite index automatically.

---

## Testing migrations — idempotency and safe reversal

Postgres runs inside Docker. Start it before running any migration commands:

```sh
docker compose up -d postgres
```

`pnpm migration:*` commands run on the host and connect to the Docker container via the
credentials in `.env`. Schema inspection uses `docker compose exec` to run `psql` inside
the container directly.

### Idempotency

Every `up()` statement uses `IF NOT EXISTS` so re-running a migration never throws. TypeORM
also tracks applied migrations in the `migrations` table and skips them on repeat runs — but
defensive SQL is the safety net if that record is ever lost.

Verify after `pnpm migration:run`:

```sh
# Run a second time — must complete with "No migrations are pending" and 0 errors
pnpm migration:run

# Confirm all three are recorded
pnpm migration:show
```

Spot-check the schema via the Docker container:

```sh
# Shorthand — substitute your DATABASE_USER / DATABASE_NAME values from .env
DB_EXEC="docker compose exec postgres psql -U postgres -d distill_ai"

$DB_EXEC -c "\dt"          # all expected tables present
$DB_EXEC -c "\d requests"  # current_node + processing_started_at exist with defaults
$DB_EXEC -c "\d tool_calls"
$DB_EXEC -c "\dx"          # vector and citext extensions listed
$DB_EXEC -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'requests';"
# ↑ requests_stale_processing_idx must show WHERE status = 'parsing'
```

Check the CHECK constraint fires correctly:

```sh
# Must fail — 'invalid_node' is not in the enum
docker compose exec postgres psql -U postgres -d distill_ai -c \
  "INSERT INTO requests (org_id, channel, current_node) VALUES (gen_random_uuid(), 'email', 'invalid_node');"

# Must succeed
docker compose exec postgres psql -U postgres -d distill_ai -c \
  "INSERT INTO requests (org_id, channel, current_node) VALUES (gen_random_uuid(), 'email', 'parse');"
```

### Safe reversal (round-trip test)

Run the full revert–reapply cycle on a dev DB before opening the PR:

```sh
# Revert all three in reverse order
pnpm migration:revert   # removes 0003
pnpm migration:revert   # removes 0002
pnpm migration:revert   # removes 0001

# Verify tables are gone (only the TypeORM migrations table should remain)
docker compose exec postgres psql -U postgres -d distill_ai -c "\dt"

# Re-apply from scratch — must complete without errors
pnpm migration:run

# Confirm show matches expected state
pnpm migration:show
```

If any step throws, the `down()` method is incomplete. Common gaps to check:

- `DROP TABLE` order must respect foreign key dependencies (children before parents)
- `DROP EXTENSION` in `down()` only if it didn't already exist before the migration ran — safer to omit and document
- `DROP INDEX` before `DROP TABLE` is not required (dropping the table cascades), but explicit is clearer

### PR gate

Both checks — idempotency and round-trip — must pass locally before the PR is raised.
Add the results as test evidence in the PR template's **Test Evidence** section (a terminal
screenshot of `pnpm migration:show` output after the full round-trip is sufficient).

---

## Why each hand-written migration can't be generated

### Migration 0001 — blockers

| Element | Why TypeORM can't generate it |
| --- | --- |
| `CREATE EXTENSION IF NOT EXISTS vector` | Extensions are outside entity scope |
| `CREATE EXTENSION IF NOT EXISTS citext` | Same |
| `VECTOR(384)` on `skus.embedding` | Not a native TypeORM column type |
| `CITEXT` on email columns | Not a native TypeORM column type |
| `bigint GENERATED ALWAYS AS IDENTITY` on `audit_events` | TypeORM generates `serial`/sequence, not identity columns |
| `REVOKE UPDATE, DELETE ON audit_events` | Privilege management is outside migration scope |

### Migration 0002 — one blocker

| Element | Why TypeORM can't generate it |
| --- | --- |
| Partial index `WHERE status = 'parsing'` | `@Index()` decorator has no `where` option |

The two column additions (`current_node`, `processing_started_at`) and the CHECK constraint
(`@Check()` decorator) are generatable — but since the partial index forces a manual file
anyway, it's cleaner to write the whole migration by hand (it's only 3 SQL statements).

---

## Special handling per entity

### `skus.embedding` — pgvector mismatch

- Entity: `@Column({ type: 'text', nullable: true }) embedding: string | null`
- Migration 0001: `embedding VECTOR(384)`
- The entity type is a deliberate lie to TypeORM so the app compiles; the DB column is correct.

### `users.email` / `requests.sender_email` — CITEXT

- Entity: `@Column({ type: 'text' }) email: string`
- Migration 0001: `email CITEXT`

### `audit_events` — append-only, non-UUID PK

- Does not extend `BaseEntity` (UUID + `updated_at` don't apply)
- Entity uses `@PrimaryGeneratedColumn('increment')` which maps to a `bigint` sequence
- Migration adds a comment flagging the `REVOKE` that must be applied manually per environment

### `candidate_matches` — no timestamps

- Thin join table; no `created_at` / `updated_at`; no base class

---

## Entities that already have their `tests/` directory

These module directories exist from the test-placeholder PR — entity files drop in alongside:

- `src/modules/extraction/` (`tests/reconciliation.spec.ts` already there)
- `src/modules/catalog/` (`tests/matcher.spec.ts` already there)
- `src/modules/pricing/` (`tests/pricing.spec.ts` already there)

The remaining module directories (`organizations`, `requests`, `quotes`, `clarification`,
`tools`, `events`) are new and created implicitly by writing the entity files.

---

## What is NOT in this PR

- Module files (`*.module.ts`) — entities are picked up by the `data-source.ts` glob for
  CLI migration generation; runtime `TypeOrmModule.forFeature` registration happens when each
  domain module is built in its epic
- `ModelAction` classes — built alongside the module in each epic
- Services, controllers, DTOs — not in scope

---

## Acceptance criteria mapping

| AC | Covered by |
| --- | --- |
| Tables migrate on startup | `pnpm migration:run` applies all three in order |
| `tool_calls` table created | Migration 0003 (generated) |
| Migrations idempotent on re-run | All DDL uses `IF NOT EXISTS`; `down()` reverses cleanly |
| `current_node` + `processing_started_at` with defaults | Migration 0002 |
| `current_node` CHECK constraint enumerating all node names | Migration 0002 |
| `(request_id, created_at)` index on `tool_calls` | Migration 0003 (via `@Index()`) |

---

## Branch and PR

```sh
git checkout -b feat/US-E8-3-schema-migrations
```

PR title: `feat(database): US-E8-3 migrate core business tables and pipeline columns`
Target: `dev`
Refs: `Closes US-E8-3-T1`, `Closes US-E8-3-T2`, `Closes US-E8-3-T3`
