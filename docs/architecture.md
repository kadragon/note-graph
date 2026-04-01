# Architecture

## Layer Map

```
[Browser / PWA]
    |
    v
[Cloudflare CDN — static assets from dist/web/]
    |
    v
[Cloudflare Worker — Hono]
    |--- Middleware: auth → repositories → validation → cacheHeaders
    |--- Routes (19 endpoints under /api)
    |--- Services (26 — business logic, AI orchestration)
    |--- Repositories (12 — raw SQL via DatabaseClient)
    |
    +---> [Supabase PostgreSQL via Hyperdrive]
    +---> [Cloudflare Vectorize — cosine 1536d]
    +---> [Cloudflare R2 — file storage]
    +---> [OpenAI via AI Gateway — embeddings, chat]
    +---> [Google APIs — OAuth, Drive, Calendar]
```

## Dependency Rules

1. **Routes** depend on **Services** and **Schemas**. Never access repositories directly.
2. **Services** depend on **Repositories** and other services. Constructed with DI (constructor injection).
3. **Repositories** depend only on **DatabaseClient**. Raw SQL, no ORM.
4. **Middleware** sets up context (`Variables`) — auth user, db, repositories, validated body/query.
5. **Shared types** (`packages/shared/types/`) are the contract between frontend and backend. Both sides import from `@shared`.
6. **Frontend hooks** wrap React Query. Each hook maps to one API call via `APIClient`.
7. **No circular imports** between layers. Direction: routes → services → repositories → db.

## Module Registry

### Backend (`apps/worker/src/`)

| Module | Path | Count | Role |
|---|---|---|---|
| Routes | `routes/` | 19 | HTTP endpoint definitions |
| Services | `services/` | 26 | Business logic, AI orchestration |
| Repositories | `repositories/` | 12 | Data access (SQL) |
| Schemas | `schemas/` | 10+ | Zod validation |
| Middleware | `middleware/` | 6 | Request pipeline |
| Adapters | `adapters/` | 4 | DB abstraction (Supabase/PGlite) |
| Types | `types/` | 3 | Context, errors, env bindings |

### Frontend (`apps/web/src/`)

| Module | Path | Count | Role |
|---|---|---|---|
| Pages | `pages/` | 20+ | Route-level components (lazy-loaded) |
| Hooks | `hooks/` | 50+ | React Query data/mutation hooks |
| Components | `components/` | 40+ | Radix UI + shadcn/ui |
| Lib | `lib/` | 5 | APIClient, query keys, utils |
| Contexts | `contexts/` | 1 | Auth context |
| Types | `types/` | 3 | API types, models |

### Shared (`packages/shared/types/`)

13 type modules: auth, work-note, todo, person, department, search, task-category, work-note-group, setting, pdf, daily-report, statistics, ai-gateway-log.

## External Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---|---|---|
| `HYPERDRIVE` | Hyperdrive | PostgreSQL connection pooling to Supabase |
| `VECTORIZE` | Vectorize | Vector index `worknote-vectors` (1536d, cosine) |
| `R2_BUCKET` | R2 | Object storage `worknote-files` |
| `AI_GATEWAY` | AI | OpenAI proxy with logging |
| `ASSETS` | Assets | Static frontend files from `dist/web/` |

## Structural Tests

| Rule | Test File | Status |
|------|-----------|--------|
| Routes must not import from repositories | `tests/unit/structural-layer-imports.test.ts` | 3 violations (remediation in backlog) |
| Repositories must not import from services or routes | `tests/unit/structural-layer-imports.test.ts` | Passing |
| Services must not import from routes | `tests/unit/structural-layer-imports.test.ts` | Passing |

## Key Patterns

- **Async Embedding**: CRUD triggers embedding via `c.executionCtx.waitUntil()`. Cron rescues pending every 5 min.
- **Hybrid Search (RRF)**: FTS + semantic vector search combined via Reciprocal Rank Fusion.
- **Router Factory**: `createProtectedRouter()` = auth + error handling. `createErrorHandledRouter()` = error handling only.
- **DatabaseClient interface**: `queryOne`, `queryMany`, `queryRaw`, `exec`. Backed by postgres.js (prod) or PGlite (test).
- **React Query conventions**: `qk.*` namespace for query keys. Hooks return `{ data, isPending, error }`. Mutations invalidate related keys.

## Database

23 tables in Supabase PostgreSQL. Key enums: `employment_status_enum`, `todo_status_enum`, `repeat_rule_enum`, `pdf_job_status_enum`. FTS via `tsvector` generated columns + trigram indexes. Migrations in `supabase/migrations/`.
