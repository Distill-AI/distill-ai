# Distill AI

An AI orchestration agent that converts unstructured inbound B2B sales requests — vague emails, annotated PDFs, messy spreadsheets — into structured, margin-safe quote drafts with clear human checkpoints.

The V1 MVP is built for hackathon launch and targets three technical innovations: an AI-driven ingestion engine, semantic catalog-mapping logic, and a Human-in-the-Loop (HITL) approval UI.

---

## How it works

```text
Inbound request (email / form / PDF)
        │
        ▼
  [ Ingestion ]  — intake and store the raw request
        │
        ▼
  [ Extraction ] — AI parses fields, normalises values, assigns confidence scores
        │
        ▼
  [ Catalog Mapping ] — matches line items to internal SKUs via semantic search
        │
        ▼
  [ Quote Generation ] — rules engine assembles a margin-safe draft
        │
        ▼
  [ HITL Approval UI ] — estimator reviews, corrects, and signs off
        │
        ▼
  Approved quote draft
```

Each stage runs as an async job. The React UI receives real-time progress updates via Server-Sent Events and presents the draft for human review before anything leaves the system.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| API | NestJS v10 (Express), TypeScript 5.7 |
| Client | React 19 + Vite 8 + Tailwind CSS v4 |
| Database | PostgreSQL 15 via TypeORM |
| Queue | Bull + Redis (ioredis) |
| Realtime | Server-Sent Events (SSE) |
| Testing | Vitest + Testing Library (both packages) |
| Linting | ESLint (flat config) + Prettier |
| Containers | Docker + Docker Compose (full stack) |
| Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions → GHCR → SSH + Docker Compose |

---

## Monorepo layout

```text
distill-ai/
├── src/                        ← NestJS API
│   ├── modules/
│   │   ├── ingestion/          ← email / form / PDF intake
│   │   ├── extraction/         ← AI parsing + confidence scoring
│   │   ├── catalog/            ← SKU lookup + semantic matching
│   │   ├── quotes/             ← rules engine + draft assembly
│   │   ├── approval/           ← HITL review queue + audit trail
│   │   ├── jobs/               ← Bull queue producer
│   │   ├── redis/              ← caching, locks, rate limiting
│   │   └── health/             ← health check endpoint
│   ├── queue/                  ← Bull processor + DLQ handler
│   └── sse/                    ← SSE bridge for real-time UI updates
├── client/                     ← React HITL approval UI
│   └── src/
│       ├── pages/              ← Dashboard, approval views
│       ├── components/         ← Shared UI components
│       ├── hooks/              ← Data fetching hooks (TanStack Query)
│       └── api/                ← Typed API client
├── pnpm-workspace.yaml
├── Dockerfile.api              ← multi-stage: build → slim runtime (api + worker)
├── Dockerfile.client           ← multi-stage: vite build → nginx:alpine
├── nginx.conf                  ← SPA fallback + /api proxy
└── docker-compose.yml          ← all 5 services: postgres, redis, api, worker, client
```

For module conventions, coding standards, and contribution rules see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Quick start

### Option A — Docker (full stack, no Node required)

Prerequisite: Docker.

```sh
git clone https://github.com/[org]/distill-ai.git
cd distill-ai
cp .env.example .env
docker compose up --build
```

All 5 services start in the correct order. First run takes ~2 minutes to build images.

- **HITL UI**: `http://localhost`
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Health check**: `http://localhost:3000/api/v1/health`

### Option B — Dev mode (watch mode for active development)

Prerequisites: Node.js 22+, pnpm 11+, Docker.

```sh
git clone https://github.com/[org]/distill-ai.git
cd distill-ai
pnpm install
cp .env.example .env
```

Start Postgres and Redis:

```sh
docker compose up postgres redis -d
```

Run migrations, then start API + worker + client dev server:

```sh
pnpm migration:run
pnpm dev                         # API (port 3000) + worker, watch mode
pnpm --filter client dev         # Vite dev server (port 5173), proxies /api → 3000
```

- **HITL UI**: `http://localhost:5173`
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Health check**: `http://localhost:3000/api/v1/health`

---

## Environment variables

All variables are validated at startup via Zod (`src/config/env.ts`). The app refuses to start if a required variable is missing or invalid.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_HOST` | ✓ | — | Postgres host |
| `DATABASE_PORT` | ✓ | `5432` | Postgres port |
| `DATABASE_USER` | ✓ | — | Postgres user |
| `DATABASE_PASSWORD` | ✓ | — | Postgres password |
| `DATABASE_NAME` | ✓ | `distill_ai` | Database name |
| `DATABASE_SYNC` | | `false` | TypeORM synchronize — **never `true` in prod** |
| `REDIS_HOST` | ✓ | `localhost` | Redis host |
| `REDIS_PORT` | | `6379` | Redis port |
| `REDIS_PASSWORD` | | — | Redis auth password |
| `REDIS_TLS` | | `false` | Enable TLS for Redis |
| `LOG_LEVEL` | | `info` | Pino log level |
| `SWAGGER_ENABLED` | | `true` | Enable Swagger UI |
| `CORS_ORIGIN` | | `*` | Allowed CORS origin(s) |
| `PORT` | | `3000` | API listen port |
| `QUEUE_CONCURRENCY` | | `3` | Bull worker concurrency per process |
| `QUEUE_MAX_ATTEMPTS` | | `3` | Max job retry attempts before DLQ |

---

## Testing

Both packages use Vitest.

```sh
# API
pnpm test               # run once
pnpm test:watch         # watch mode
pnpm test:cov           # with coverage

# Client
pnpm --filter client test
pnpm --filter client test:watch
pnpm --filter client test:cov
```

API unit tests live in `src/<module>/tests/*.spec.ts` — plain `new ServiceClass(mockDeps)`, no NestJS test module, no database.

Client tests live in `client/src/` as `*.spec.tsx` using `@testing-library/react`.

---

## Database & Migrations

`synchronize` is always `false`. Schema changes go through migrations.

```sh
pnpm migration:generate src/database/migrations/<Name>   # diff entities → SQL
pnpm migration:run                                        # apply pending
pnpm migration:revert                                     # roll back last
pnpm migration:show                                       # list applied/pending
pnpm db:reset                                            # drop all + re-migrate (dev only)
```

---

## Deployment

Two workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | Every push + PR | Lint, test, build (API + client), security scans |
| `deploy.yml` | Push to `staging` or `main` | Build images → push to GHCR → SSH into ECS → `docker compose pull && up -d` → migrate → health check |

Promotion path: `dev` → PR → `staging` → PR → `main`.

### Infrastructure

Single Alibaba Cloud ECS (2 vCPU, 4GB). Staging and production run as isolated Docker Compose projects on the same host:

| Environment | Compose project | Ports |
| --- | --- | --- |
| Production | `distill-prod` | 80 (UI), 3000 (API) |
| Staging | `distill-staging` | 8080 (UI), 3001 (API) |

Images are stored in GHCR (`ghcr.io/[org]/distill-ai/api` and `client`), tagged as `<branch>-<sha>` for pinned rollbacks.

### GitHub secrets

Set at repo level (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ECS_HOST` | ECS public IP |
| `ECS_USERNAME` | SSH user (`ubuntu`, `root`) |
| `ECS_SSH_KEY` | Private SSH key |

`GITHUB_TOKEN` is automatic — no secret needed for GHCR push.

### Rollback

Re-run the deploy job with `IMAGE_TAG` set to a previous `<branch>-<sha>` tag.

---

## Scripts reference

### API (root)

```sh
pnpm dev                    # API + worker (watch mode, concurrently)
pnpm start:dev              # API only (watch mode)
pnpm worker:dev             # Worker only (watch mode)
pnpm build                  # Compile TypeScript → dist/
pnpm test                   # Vitest (run once)
pnpm test:watch             # Vitest (watch)
pnpm test:cov               # Vitest + coverage
pnpm lint                   # ESLint --fix
pnpm lint:check             # ESLint (no fix)
pnpm format                 # Prettier write
pnpm migration:generate src/database/migrations/<Name>
pnpm migration:run
pnpm migration:revert
pnpm db:reset               # Dev only
```

### Client

```sh
pnpm --filter client dev          # Vite dev server (port 5173)
pnpm --filter client build        # Production build → client/dist/
pnpm --filter client test         # Vitest (run once)
pnpm --filter client test:watch   # Vitest (watch)
pnpm --filter client lint         # ESLint --fix
pnpm --filter client format       # Prettier write
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide — coding standards, module conventions, branch naming, commit format, PR process, and ticket references.
