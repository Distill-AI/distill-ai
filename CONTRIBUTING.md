# Contributing to Distill AI

Thank you for contributing to **Distill AI** — an AI orchestration agent that converts messy inbound B2B sales requests into structured, margin-safe quote drafts.
This document covers everything your team needs to set up locally, write consistent code, and ship features through a clean review process.

---

## What We're Building

The V1 MVP focuses on three things:

1. **AI Ingestion Engine** — parses inbound emails, form submissions, and PDF spec sheets into structured data
2. **Semantic Catalog Mapper** — matches extracted line items to internal product SKUs with confidence scores
3. **HITL Approval UI** — a React interface where estimators review, correct, and approve AI-generated quote drafts before they go out

Every contribution should advance one of these three areas or the infrastructure that supports them.

---

## Monorepo Layout

This repository is a **pnpm workspace** with two packages living side by side:

```text
distill-ai/                          ← workspace root
├── src/                             ← NestJS API (server)
├── client/                          ← React + Vite app (HITL UI)
├── pnpm-workspace.yaml              ← declares the two packages
├── package.json                     ← root (API) scripts + deps
└── client/package.json              ← client scripts + deps
```

### The server (`src/`)

Built with **NestJS v10** on Express, TypeScript 5.7. It owns:

- All AI pipeline logic — ingestion, extraction, catalog mapping, quote generation
- The REST API consumed by the client (`/api/v1/*`)
- Background job processing via Bull + Redis
- Server-Sent Events for real-time status push to the HITL UI
- PostgreSQL persistence via TypeORM + `AbstractModelAction`

The root `package.json` is the server's package. All server commands run from the repo root.

### The client (`client/`)

Built with **React 19 + Vite 8**, TypeScript, Tailwind CSS 4. It owns:

- The HITL approval UI — the estimator's review, correction, and sign-off flow
- TanStack Query for data fetching and cache management
- React Router v7 for page routing
- Vitest + Testing Library for component tests

Client commands are scoped with `pnpm --filter client <script>`.

### How they connect

In **development**, Vite's dev server runs on port 5173 and proxies every `/api` request to the NestJS server on port 3000. No CORS config needed locally.

```text
Browser → :5173 (Vite HMR)
           └─ /api/* proxied → :3000 (NestJS)
```

In **production**, NestJS serves the pre-built client bundle as static files. A single process handles both the API and the UI.

### Running each part

| Goal | Command | Port |
| --- | --- | --- |
| API + worker together | `pnpm dev` | 3000 |
| API only | `pnpm start:dev` | 3000 |
| Worker only | `pnpm worker:dev` | — |
| Client only | `pnpm --filter client dev` | 5173 |
| Full local stack | `pnpm dev` + `pnpm --filter client dev` in a second terminal | 3000 + 5173 |

### Running commands in each package

```sh
# Server (root)
pnpm lint
pnpm test
pnpm build

# Client (scoped)
pnpm --filter client lint
pnpm --filter client test
pnpm --filter client build
```

CI runs both sets of checks independently — a server lint failure does not block the client job and vice versa.

### Who works where

| Role | Primary workspace |
| --- | --- |
| AI / backend engineers | `src/modules/` — ingestion, extraction, catalog, quotes |
| Frontend engineers | `client/src/` — HITL approval UI |
| Full-stack / infra | Both, plus `src/queue/`, `src/sse/`, `docker-compose.yml` |

If your PR touches both packages, note that in the PR description and confirm both `pnpm test` and `pnpm --filter client test` pass.

---

## Getting Started

### 1. Clone the repository

Branch off `dev` directly if you have write access. External contributors should fork first.

```sh
git clone https://github.com/[org]/distill-ai.git
cd distill-ai
```

### 2. Install dependencies

This project uses **pnpm 9+** (workspace). Translate any `npm`/`yarn` commands.

```sh
pnpm install
```

### 3. Configure your environment

```sh
cp .env.example .env
```

Fill in your PostgreSQL credentials, Redis connection, and any AI provider keys.
The app validates env at boot via Zod and fails fast on missing or invalid values — check `src/config/env.ts` for the required keys.

### 4. Set up the database

```sh
createdb distill_ai
pnpm migration:run
```

### 5. (Optional) Seed development data

```sh
pnpm seed:db
```

### 6. Start the development server

```sh
pnpm dev          # API + worker concurrently
pnpm start:dev    # API only
pnpm worker:dev   # worker process only
```

Swagger UI: `http://localhost:3000/api/docs`

---

## How to Contribute

### Picking Up Work

- Each piece of work needs a tracked ticket (`US-E<epic>-<story>`) before code is written.
- Check the project board before starting — confirm your work doesn't overlap an in-flight branch.
- Scope each branch to a single concern. If you find unrelated work while implementing, open a separate ticket.

### Reporting Bugs

Use the **[FIX] bug report** issue template (`.github/ISSUE_TEMPLATE/fix.md`). It will prompt you for:

- The affected module and package (server/client/both)
- Steps to reproduce
- Expected vs. actual behaviour
- Logs, screenshots, or error payloads

### Suggesting Features

Use the **[FEAT] feature** issue template (`.github/ISSUE_TEMPLATE/feat.md`). It will prompt you for:

- The affected module and package
- What should be built and acceptance criteria
- How it fits within the ingestion → extraction → approval flow

---

## Development Workflow

```sh
# 1. Sync with dev
git checkout dev
git pull origin dev

# 2. Create your branch
git checkout -b feat/US-E8-4-pdf-confidence-scoring

# 3. Make focused changes, commit often
git commit -m "feat(extraction): add confidence score to line-item parser"

# 4. Push and open a PR targeting dev
git push origin feat/US-E8-4-pdf-confidence-scoring
```

---

## Module Structure

### Server (`src/modules/<name>/`)

Every server feature follows this layout:

```text
<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts       # HTTP only — no business logic
├── <feature>.service.ts          # Thin orchestrator
├── <feature>.model-action.ts     # AbstractModelAction wrapper
├── docs/
│   ├── <feature>-response.dto.ts # @ApiProperty DTOs for Swagger
│   └── <feature>-swagger.doc.ts  # applyDecorators factory functions
├── dto/                          # Validated input shapes (class-validator)
├── entities/                     # TypeORM entities
└── tests/
    └── <feature>.service.spec.ts
```

Current server domain modules:

| Domain | Module path | Owns |
| --- | --- | --- |
| Request ingestion | `src/modules/ingestion/` | Email/form/PDF intake, raw request storage |
| Extraction | `src/modules/extraction/` | AI parsing, field normalisation, confidence scoring |
| Catalog mapping | `src/modules/catalog/` | SKU lookup, semantic matching, gap detection |
| Quote generation | `src/modules/quotes/` | Rules engine, margin logic, draft assembly |
| HITL approval | `src/modules/approval/` | Review queue, correction capture, audit trail |
| Jobs / queue | `src/modules/jobs/`, `src/queue/` | Async pipeline orchestration |
| Redis | `src/modules/redis/` | Caching, distributed locks, rate limiting |

### Client (`client/src/`)

```text
client/src/
├── api/              # TanStack Query hooks, axios client, query key factories
├── components/
│   ├── shell/        # Persistent layout — AppShell, Sidebar, DistillMark
│   └── ui/           # Reusable primitives — ConfidenceChip, StatusBadge, etc.
├── context/          # React contexts — RoleContext, etc.
├── hooks/            # Custom hooks (use* prefix, one hook per file)
├── lib/              # Pure utilities — logger, formatters (no React imports)
├── pages/            # Route-level components (one file per route)
├── tokens.json       # Brand token source of truth
├── index.css         # Tailwind @theme block + global resets
├── App.tsx           # Router + top-level providers
└── main.tsx          # Entry point — mounts providers, no logic
```

File naming: `PascalCase.tsx` for components and pages, `camelCase.ts` for hooks, utilities, and API modules.

---

## Coding Standards

These are mandatory on every PR. Call them out in review if you see drift.

### 1. `HttpStatus` — no hardcoded status codes

```ts
// Bad
return { status_code: 200, message: 'Quote created' };

// Good
import { HttpStatus } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';

return { statusCode: HttpStatus.CREATED, message: SYS_MSG.QUOTE_CREATED, data: { id } };
```

### 2. System message constants — no free-text strings

Source of truth: `src/constants/system-messages.ts`

Add the constant there **before** using it anywhere.

```ts
// Bad
message: 'Extraction complete'

// Good
message: SYS_MSG.EXTRACTION_COMPLETE
```

### 3. No `any` in the codebase

Zero `any` types in DTOs, services, controllers, helpers, or utilities. Use `unknown` and narrow it.

### 4. Strongly typed signatures

Annotate all parameters and return types explicitly.

```ts
async extractLineItems(requestId: string): Promise<ExtractionResult> { ... }
```

### 5. Repository pattern via `AbstractModelAction`

Services must never inject a raw `Repository<T>`. Every entity gets a `*ModelAction` class:

```ts
@Injectable()
export class QuoteModelAction extends AbstractModelAction<Quote> {
  constructor(@InjectRepository(Quote) repository: Repository<Quote>) {
    super(repository, Quote);
  }
}
```

### 6. Controller response shapes

All responses go through `TransformInterceptor`. Never call `res.json()` directly and never include `success: true` in your return — the interceptor adds it.

#### Shape A — structured with data (most endpoints)

```ts
return {
  statusCode: HttpStatus.OK,
  message: SYS_MSG.QUOTE_FETCHED,
  data: quote,
};
```

#### Shape B — message only

```ts
return { statusCode: HttpStatus.OK, message: SYS_MSG.APPROVAL_SUBMITTED };
```

#### Shape C — pass-through (service already returns the payload)

```ts
return this.quotesService.findById(quoteId);
```

> Shape A/B requires **both** `statusCode` and `message`. Without `message`, the interceptor treats the whole object as Shape C data.

### 7. Error handling

Use `CustomHttpException` everywhere — never `throw new Error()`.

```ts
throw new CustomHttpException(SYS_MSG.EXTRACTION_FAILED, HttpStatus.UNPROCESSABLE_ENTITY);
```

### 8. Domain events — emit after the transaction, never inside it

```ts
// Correct
await queryRunner.commitTransaction();
this.eventEmitter.emit(APP_EVENTS.EXTRACTION_COMPLETE, new ExtractionCompleteEvent(...));

// Wrong — transaction may roll back after emit fires
await queryRunner.manager.save(result);
this.eventEmitter.emit(APP_EVENTS.EXTRACTION_COMPLETE, ...);
```

Listeners must wrap all logic in try/catch and never rethrow. `emit()` is fire-and-forget; async rejections inside listeners become unhandled promise rejections.

### 9. No PII in event payloads

Never put email addresses, passwords, or raw document content in event classes. Use IDs for correlation.

### 10. JSDoc on every exported service method

```ts
/** Parses a raw inbound request document and returns extracted line items with confidence scores. */
async extract(requestId: string): Promise<ExtractionResult> { ... }
```

Private helpers don't need JSDoc.

### 11. No inline comments

Code is self-explanatory via naming. Only comment when there is a hidden constraint or non-obvious invariant.

### 12. No em-dashes

Em-dashes (`—`) are banned in all code, comments, and user-facing strings. Use a colon or a plain hyphen instead.

```ts
// Bad
message: 'Full access — inbox and quotes'
// Good
message: 'Full access: inbox and quotes'
```

---

## Client Coding Standards

These rules apply to all work in `client/src/`. Apply them with the same rigour as the server standards above.

### Accessibility (a11y)

Every interactive component must be keyboard-operable and screen-reader-friendly:

- All `<button>` elements must have `type="button"` (or `type="submit"` inside a `<form>`).
- Overlay / off-canvas drawers require:
  - `aria-expanded` and `aria-controls` on the trigger button
  - Escape key closes the drawer and returns focus to the trigger
  - Focus trap: Tab/Shift+Tab cycle within the open drawer; focus does not escape to content behind the overlay
  - First focusable element inside the drawer receives focus on open
- Decorative SVG icons must carry `aria-hidden="true"`.
- Landmark elements (`<nav>`, `<header>`, `<main>`) must have an `aria-label` when more than one of the same type appears on the page.

---

## Client Coding Standards

These apply to every `.tsx` / `.ts` file under `client/src/`. They sit alongside the server standards above — a PR touching both packages must satisfy both sets.

### 1. Component structure

One component per file. Props interface directly above the component. Use named exports.

```tsx
interface RequestRowProps {
  company: string;
  confidence: number;
  status: RequestStatus;
}

export function RequestRow({ company, confidence, status }: RequestRowProps) {
  // ...
}
```

### 2. No `any` — same rule as the server

Use `unknown` and narrow, or define the exact shape.

### 3. Token-first styling

All colours, fonts, and radii come from the `@theme` tokens in `client/src/index.css`. Never hardcode hex values in `className` or `style` props. If a value isn't in the token set, add it to `tokens.json` and `index.css` first, then use the generated utility class.

```tsx
// Bad
<div className="bg-[#4F46E5] text-[#0F172A]">

// Good
<div className="bg-indigo-600 text-slate-900">
```

### 4. State management boundaries

| State type | Tool |
| --- | --- |
| Server data (requests, quotes, SKUs) | TanStack Query (`useQuery`, `useMutation`) |
| Shared UI / demo state (role, theme) | React Context |
| Ephemeral local state (form, toggle) | `useState` / `useReducer` |

Never use context for server data — TanStack Query owns the cache.

### 5. Query key factories

Query keys live in `client/src/api/` beside their fetcher. Never hardcode key strings inline.

```ts
// client/src/api/requests.ts
export const requestKeys = {
  all: ['requests'] as const,
  list: () => [...requestKeys.all, 'list'] as const,
  detail: (id: string) => [...requestKeys.all, id] as const,
};
```

### 6. Testing

Use Testing Library queries in priority order: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`. Avoid `getByTestId` unless the element has no accessible role or label.

Test behaviour, not implementation — assert what a user sees, not which internal function was called.

```tsx
// Good
expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();

// Bad — tests implementation detail
expect(mockOnApprove).toHaveBeenCalled();
```

### 7. No inline comments

Same rule as the server. Name things clearly; only comment hidden constraints or non-obvious invariants.

---

## Swagger Documentation

Each endpoint gets its own decorator factory in `docs/<feature>-swagger.doc.ts`:

```ts
// src/modules/quotes/docs/quotes-swagger.doc.ts
export function GetQuoteDocs() {
  return applyDecorators(
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Fetch a quote draft by ID' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: SYS_MSG.QUOTE_FETCHED,
      schema: {
        properties: {
          success:    { type: 'boolean', example: true },
          statusCode: { type: 'number',  example: 200 },
          message:    { type: 'string',  example: SYS_MSG.QUOTE_FETCHED },
          data:       { $ref: getSchemaPath(QuoteResponseDto) },
        },
      },
    }),
    ApiExtraModels(QuoteResponseDto),
    ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Quote not found.' }),
  );
}
```

Rules:

- One factory per endpoint, named after the operation
- `description` always uses a `SYS_MSG` constant
- Document every `ApiResponse` status the endpoint can return
- Note in `description` when an endpoint cannot be tested via Swagger "Try it out" (e.g. file upload endpoints)

---

## Testing

Run the suite before opening a PR:

```sh
pnpm test           # unit tests (vitest)
pnpm test:cov       # with coverage
pnpm build          # TypeScript compile check
```

Unit test conventions:

- `*.spec.ts` files live in a `tests/` subfolder beside the module
- Use plain `new ServiceClass(mockDeps)` — no `Test.createTestingModule` for unit tests
- Mock at the service boundary — mock sub-services and `*ModelAction`, not their internals
- If you add or change behaviour, include or update tests

### Test evidence in every PR

Every PR must include at least one of:

- Screenshot of Swagger UI or Postman/HTTP client showing the endpoint request and response (server changes)
- Browser screenshot of the rendered UI at the relevant breakpoint (client changes)

Both are required when a PR touches server and client. PRs without test evidence will not be reviewed.

---

## Branch Naming

```sh
<type>/US-E<epic>-<story>-short-description
```

Include the ticket number when one exists. Use kebab-case, lowercase.

**Valid types:**

| Type | Use for |
| --- | --- |
| `feat/` | new features |
| `fix/` | bug fixes |
| `refactor/` | code restructuring, no behaviour change |
| `chore/` | deps, configs, CI |
| `docs/` | documentation only |
| `test/` | test additions or updates |
| `perf/` | performance improvements |
| `ci/` | CI configuration |

**Examples:**

```sh
feat/US-E1-2-email-ingestion-parser
fix/US-E3-4-confidence-score-edge-case
refactor/US-E5-6-extraction-service-split
docs/US-E0-1-update-architecture-diagram
```

---

## Commit Message Rules

This repo enforces [Conventional Commits](https://www.conventionalcommits.org) via commitlint.

```text
type(scope): short summary in imperative mood
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scopes** map to domains. Server scopes: `ingestion`, `extraction`, `catalog`, `quotes`, `approval`, `queue`, `redis`, `sse`, `auth`. Client scopes: `client` (shell / cross-cutting), `inbox`, `review`, `clarification`, `analytics`, `settings`.

**Examples:**

```text
feat(ingestion): add PDF multipart upload endpoint
fix(extraction): handle empty line items from malformed PDFs
refactor(quotes): extract margin-rule logic into sub-service
test(approval): add unit tests for HITL review state machine
chore(deps): upgrade vitest to v4
feat(client): add AppShell sidebar layout with brand tokens
feat(inbox): add request list table with confidence chips
feat(settings): add role switcher with localStorage persistence
```

Rules:

- Imperative mood — "add", not "added"
- Subject line ≤ 72 characters, no trailing period
- Use `!` or `BREAKING CHANGE:` footer for breaking changes
- Reference tickets in footers: `Refs: US-E8-4`, `Closes US-E5-6`

---

## Submitting Pull Requests

1. Make sure your branch is current with `dev`:

   ```sh
   git pull origin dev
   ```

2. Run local checks:

   ```sh
   pnpm lint
   pnpm build
   pnpm test
   ```

3. Run the security scans:

   ```sh
   node scripts/forbidden-pattern-scan.js .
   pnpm audit --audit-level=high
   pnpm --filter client audit --audit-level=high
   ```

   The forbidden-pattern scan also runs automatically on every commit via Husky. All three run on every PR in CI.

   If `pnpm audit` reports a high-severity vulnerability, bump the affected package's override in `pnpm-workspace.yaml` (adding the new advisory ID to the comment), delete `pnpm-lock.yaml`, run `pnpm install` to regenerate it, and re-run the audit before pushing. Do not raise the PR until `--audit-level=high` exits clean.

4. Open a PR from your branch to `dev`. GitHub will pre-fill `.github/PULL_REQUEST_TEMPLATE.md`. Complete every section:
   - **Ticket** — the `US-E<epic>-<story>` this resolves
   - **Package(s) affected** — server, client, or both
   - **Description** — what changed and why
   - **Test evidence** — required screenshot (see [Test evidence in every PR](#test-evidence-in-every-pr))
   - **Checklist** — all boxes ticked before requesting review
   - Mark as **draft** if work is incomplete

---

## PR Title Rules

Follow the same Conventional Commits format as commit messages.

```text
type(scope): US-E<epic>-<story> short description in imperative mood
```

**Correct:**

- `feat(ingestion): US-E1-2 add PDF spec-sheet parser`
- `fix(extraction): US-E3-4 correct confidence threshold for sparse tables`
- `refactor(quotes): normalise margin-rule interface`

**Wrong — flagged in review:**

| Bad title | Problem |
| --- | --- |
| `Feat(ingestion): PDF upload` | Capital `F` — type must be lowercase |
| `feat/US-E1-2-pdf-parser` | Branch name pasted as title |
| `feat(ingestion): implement stuff` | Vague — name the specific change |

---

## Database & Migrations

Do not enable `synchronize` in non-dev environments.

```sh
pnpm migration:generate src/database/migrations/<Name>   # generate from entity diff
pnpm migration:run                                        # apply pending
pnpm migration:revert                                     # roll back last
pnpm migration:show                                       # list applied/pending
pnpm db:reset                                            # wipe and re-run (dev only)
```

### Known TypeORM column-type drifts — always review generated migrations

Three columns use DB-native types that TypeORM cannot express in entity decorators (TypeORM 0.3.x has no column-level `synchronize: false`). The entity declares `text` as the closest compatible type; the DB holds the real type set by migration. Every `pnpm migration:generate` will produce ALTER COLUMN statements for these three columns. **Delete those ALTER COLUMN statements from any generated migration before committing.**

| Column | DB type | Entity type | Why |
| --- | --- | --- | --- |
| `users.email` | `citext` | `text` | Case-insensitive email lookups |
| `requests.sender_email` | `citext` | `text` | Case-insensitive sender matching |
| `skus.embedding` | `vector(384)` | `text` | pgvector semantic search; never written via ORM |

The `audit_events` table is excluded from TypeORM sync entirely via `@Entity('audit_events', { synchronize: false })` — it uses `BIGINT GENERATED ALWAYS AS IDENTITY` and has append-only permissions applied per environment.

---

## Environment Variables

All env vars must be declared in `src/config/env.ts` and accessed via the exported `env` object — never via `process.env` directly. The Zod schema there validates values at boot and fails fast on missing or malformed config, so a direct `process.env` read silently bypasses that safety net and loses type information.

```ts
// Bad
const dsn = process.env.SENTRY_DSN;

// Good
import { env } from '@config/env';
const dsn = env.SENTRY_DSN;
```

`src/config/env.ts` only imports `dotenv` and `zod` — it is safe to import before `reflect-metadata` and before NestJS bootstraps, which means it can also be used in process-level init files like `src/instrument.ts`.

---

## Code Style

```sh
pnpm format     # Prettier
pnpm lint       # ESLint with auto-fix
```

lint-staged runs both automatically on staged files before each commit.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
All contributors are expected to uphold respectful, inclusive, and professional interactions.
