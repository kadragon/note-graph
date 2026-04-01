# Runbook

## Build

```bash
bun install                    # Install dependencies
bun run build                  # Build frontend (vite) + backend (tsc)
bun run build:frontend         # vite build → dist/web/
bun run build:backend          # tsc → apps/worker/
```

## Dev

```bash
bun run dev                    # Frontend (:5173) + Backend (:8787) concurrently
bun run dev:frontend           # Vite dev server only
bun run dev:backend            # Wrangler dev server only
```

Frontend proxies `/api` to `http://localhost:8787` in dev mode.

## Test

```bash
bun run test                   # Unit tests (PGlite + pure) via vitest
bun run test:web               # Frontend tests (jsdom)
bun run test:all               # Both in parallel
bun run test:coverage          # With coverage report
```

Test configs:
- `vitest.config.ts` — two projects: `worker-db` (PGlite), `worker-pure` (no DB)
- `vitest.config.web.ts` — jsdom, 6 workers
- `vitest.config.pglite.ts` — minimal PGlite smoke

## Deploy

```bash
bun run deploy                     # Build + wrangler deploy
bun run deploy:with-migrations     # Build + db:migrate + wrangler deploy
```

**CRITICAL**: DB schema changes MUST use `deploy:with-migrations`. See AGENTS.md for the `migration repair` incident.

## Database

```bash
bun run db:migrate                 # Push migrations to remote Supabase
bun run db:migrate:local           # Reset local Supabase
bun run db:create-migration        # Create new migration file in supabase/migrations/
```

Migrations live in `supabase/migrations/`. Sequential timestamps.

## Lint & Type Check

```bash
bun run lint                   # Biome check
bun run lint:fix               # Biome auto-fix
bun run typecheck              # tsc --noEmit for all projects
```

Pre-commit hook (`.husky/pre-commit`) runs lint-staged: biome + tsc + related vitest.

## Common Failures

### `column X does not exist` at runtime
**Cause**: Migration not applied to remote DB. `supabase migration repair` only fixes history, not schema.
**Fix**: Run `bun run db:migrate` and verify column exists via SQL.

### Embedding not updating after work note edit
**Cause**: `waitUntil()` background task failed silently.
**Fix**: Check AI Gateway logs (`/ai-logs`). Cron retries pending every 5 min. Manual: admin reindex endpoint.

### PGlite test failures
**Cause**: Migration SQL has Supabase-specific syntax (e.g., `auth.users()`).
**Fix**: PGlite setup (`tests/pg-setup.ts`) must stub those. Check if new migration needs PGlite adaptation.

### Pre-commit hook fails on type check
**Cause**: Type error in changed files.
**Fix**: Run `bun run typecheck` to see full error. Fix types before committing.

### Vite build out of memory
**Cause**: Large bundle or missing code splitting.
**Fix**: Check `vite.config.ts` manual chunks. Ensure lazy imports for pages.

### Wrangler deploy fails — binding not found
**Cause**: New binding added in code but missing from `wrangler.toml`.
**Fix**: Add binding declaration to `wrangler.toml`.
