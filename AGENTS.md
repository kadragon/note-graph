# AGENTS.md

This file consolidates governance, specs, and task tracking previously kept under .governance/, .spec/, and .tasks/.

## Operating Directives
- Follow TDD (red -> green -> refactor) and Tidy First; do not mix structural and behavioral changes.
- Record strategic insights and governance updates here during commits.
- No SDD. Use tests to drive changes, not spec docs.
- Primary test stack: Vitest + Miniflare (Workers). Jest migration history exists but is not the current default.

## Quick Start
- Install: `bun install`
- Local env: `cp .dev.vars.example .dev.vars`
- D1 migrations (local): `bun run db:migrate:local`
- Dev (web + worker): `bun run dev`
- Tests (preferred): `bun run test` (Vitest).

## Project Overview
- Product: Worknote Management System (single-user knowledge base).
- Platform: Cloudflare Workers.
- Data: D1 (SQLite), Vectorize for embeddings, R2 for files, Google Drive for work note attachments.
- Async: Cloudflare Queues.
- Auth: Cloudflare Access (Google OAuth).
- AI: OpenAI via AI Gateway (chat: gpt-4.5-turbo, embedding: text-embedding-3-small).

## Core Architecture Decisions
- Hybrid search: FTS5 (trigram tokenizer for Korean) + Vectorize; merge via RRF (k=60).
- RAG chunking: 512 tokens with 20% overlap; metadata limited to filter keys (Vectorize 64-byte field cap).
- PDF pipeline: upload -> queue -> R2 (temporary) -> extraction -> AI draft -> cleanup; delete temp files after processing.
- Google Drive integration: OAuth 2.0 with refresh token handling; work note files stored in Drive folders (WORK-xxx); R2 fallback when OAuth not configured; view/download redirects to Drive web viewer.
- Todo recurrence: due-date or completion-date recurrence; new instance created on completion.
- Versioning: keep latest 5 versions; auto-purge oldest on insert.
- Single-user system; no multi-tenant constraints.

## Coding & API Conventions
- Language: code/comments/docs in English. User-facing strings in Korean.
- TypeScript strict; file names are kebab-case (including React components).
- Import order: external deps -> internal types -> internal services/utils -> relative.
- API: RESTful, kebab-case paths, camelCase JSON. Standard error schema { code, message, details? }.
- Status codes: 200/201/204/400/401/404/429/500.
- DB: tables snake_case plural; columns snake_case with *_id, *_at, *_date conventions.
- Index foreign keys and common filters.
- React Query mutations: Use `createStandardMutation` factory from `@web/lib/hooks/create-standard-mutation` for standard CRUD mutations with toast feedback. Supports static or dynamic (function-based) invalidateKeys. Keep manual implementations only for: optimistic updates, conditional success messages, or complex mutationFn logic.

## Testing
- Default: Vitest + @cloudflare/vitest-pool-workers.
- Local Workers emulation uses Miniflare; D1 migrations apply in setup with fallback schema.
- Known limitation: coverage in Workers is blocked by node:inspector requirements.
- Jest + Miniflare migration phases 1-3 completed historically, but Vitest remains primary.
- Builds run locally/CI with Bun; Cloudflare Workers runtime cannot execute Bun.

## Design Patterns
- Repository pattern for D1 access.
- D1 batch for atomic multi-ops.
- Trigger-based FTS index sync.
- Queue-based async processing for heavy workloads.
- DomainError subclasses for consistent error mapping; global error middleware.
- Centralized resource access helpers (e.g., R2 bucket) to avoid duplication.

## Specs Catalog (historical reference, not SDD)
- SPEC-auth-1: Authentication and user identity.
- SPEC-person-1/2/3: Person management, edit, and UX improvements.
- SPEC-dept-1: Department management.
- SPEC-worknote-1/2: Work note management, assignee badge format.
- SPEC-worknote-attachments-1: Work note file attachments.
- SPEC-worknote-gdrive-1: Google Drive integration for work note files (OAuth flow, folder management, file upload/download).
- SPEC-worknote-email-copy-001: Assignee email copy button.
- SPEC-todo-1/2: Todo management and UX improvements.
- SPEC-project-1: Project management (1:N project -> work notes, R2 permanent files, PROJECT RAG scope).
- SPEC-search-1: Hybrid search.
- SPEC-search-ui-1: Search page stability.
- SPEC-rag-1/2: RAG and embedding reliability/retry.
- SPEC-pdf-1: PDF upload and async work note generation.
- SPEC-stats-1: Statistics dashboard.
- SPEC-ui-1: Work note detail UX polish.
- SPEC-devx-1/2/3: Dev experience items (schema parity, CI opt, warning cleanup).
- SPEC-testing-migration-001: Vitest -> Jest + Miniflare migration plan.
- SPEC-governance-1: Governance file hygiene.
- Archive specs (implemented): collapsible sidebar, embedding service split, repository DI, validation middleware, base file service.

## Task Tracking Summary
- Current tasks: Google Drive integration (frontend pending).
- Backlog: empty (metadata retained in history; prior effort estimates 33-45 hours for migration plan).
- Recent completions include:
  - Google Drive integration backend: OAuth service, Drive service, repository, routes, file service updates (Phase 2-4).
  - TASK-MIGRATE-001/002/003: Jest + Miniflare migration phases 1-3 (parallel run with Vitest).
  - TASK-0070/0071: PDF draft auto-attach flow clarifications and fix.
- plan.md cleanup: archived completed Google Calendar and performance tasks.
- Full historical details are in git history and prior session notes.

## Known Issues / Tech Debt
- Vectorize delete uses query+delete workaround (no native prefix deletion).
- Consider proper tokenizer (tiktoken) instead of char-count approximation.
- Future: automatic retry processor for embedding failures.

## Lessons Learned (operational)
- Avoid localStorage reads in initial render; use useEffect to prevent hydration mismatch.
- Apply date filters inside aggregate subqueries (CTEs) to avoid historical overcount.
- Prefer CTEs over correlated subqueries for performance.
- Enforce exact import path case for cross-platform compatibility.
- Document CSS magic numbers and accessibility labels.
- Centralize integration test helpers (authFetch, MockR2, setTestR2Bucket) to keep R2 bindings consistent and avoid duplicated setup; avoid forcing Content-Type for FormData.
- When Workers coverage cannot run due to node:inspector limitations, align Vitest global thresholds with the latest reliable baseline.
- For work note due-date sorting, treat missing dates as always last regardless of sort direction to match user expectations.
- For React Query hook tests, use `apps/web/src/test/setup.tsx` helpers (e.g., `createTestQueryClient`, `renderHookWithClient`) to avoid retries/cache side effects and duplicate provider wiring.
- For mutation hooks (useMutation), assert both success data wiring and onError toast behavior to cover user-facing feedback paths.
- For query hooks with optional enable flags, include a disabled-state test to ensure no API calls and avoid accidental background fetches.
- For CRUD hook suites, cover create/update/delete success flows plus at least one failure toast path to keep user feedback verified.
- For localStorage-backed hooks, use a storage polyfill in tests when needed and assert persistence plus keyboard shortcuts without relying on initial synchronous state.
- For useToast tests, prefer direct state assertions after `act()` and timer flushing instead of `waitFor` when using fake timers.
- For debounced hooks, use fake timers to assert initial value, delayed update, and cancellation on rapid changes.
- For page tests using Radix Dialog/AlertDialog/Select, mock UI components to simple DOM elements and assert open state via data attributes to avoid portal complexity.
- For table rows with icon-only actions, scope to the row and select buttons by order to drive edit/delete flows deterministically.
- For mocked React Query hooks, cast stubbed return values via `as unknown as ReturnType<typeof useQuery>` (or mutation hooks) to satisfy strict observer typings.
- When limiting task categories to active-only in UI, preserve already-selected inactive categories in edit flows and filter AI draft forms to active categories only.
- For dialog markdown previews, keep system color mode sync via `matchMedia` and stub it in tests to avoid jsdom errors.
- For PWA navigation fallback, denylist `/api` and `/health` to avoid serving the SPA shell for file preview endpoints (e.g., `/api/work-notes/.../view`).
- For dual-storage services (R2 + Google Drive), make the external service optional via environment variable check (e.g., `GOOGLE_CLIENT_ID`) to maintain testability without mocking complex OAuth flows. Tests run in R2-only mode when OAuth credentials are absent.
- For work note attachments now using Drive-only, fail fast on missing Google OAuth env vars and set test bindings in Vitest config to avoid accidental 500s during integration tests.
- Treat `GDRIVE_ROOT_FOLDER_ID` as required for Drive-only attachments to avoid creating folders at the user's Drive root; enforce in services and test bindings.
- For Google Drive work note attachments, prefer opening `gdriveWebViewLink` in a new tab from UI actions and have download helpers return the Drive link when available.
- For Drive cleanup on work note deletion, read `work_note_gdrive_folders` before deleting file rows so folder IDs remain available, then delete files and finally the folder.
- For Drive-backed work notes with a stored folder ID, delete the folder directly and skip per-file Drive deletions to reduce API calls and avoid redundant deletes.
- When persisting `work_note_gdrive_folders`, use `INSERT OR IGNORE` to make inserts idempotent under concurrent folder creation.
- For R2→Drive migrations, reuse existing `work_note_gdrive_folders` records before calling Drive APIs and skip files with missing R2 objects to keep the migration idempotent.
- For CLI scripts in this repo, keep worker-only dependencies (like Miniflare/Drive services) behind dynamic imports so worker-based tests can import the module without bundling errors.
- For migration actions, capture per-mutation results (migrated/skipped/failed) via `mutate` callbacks and surface a short UI summary to reduce storage confusion.
- For Drive migrations, use `appProperties` to match files by `workNoteFileId` and roll back Drive uploads if DB updates fail.

## Agent Log
- 2026-01-15: Enhanced Work Note attachments UI: replaced "Open in Drive" with icon, hid preview for Drive files, and added local Drive path configuration (persisted in localStorage) to allow copying absolute file paths. Refactored `localDrivePath` state to use `useEffect` to avoid hydration/render issues.
- 2026-01-15: Documented completion of PR #202 (fix/google-drive-file-handling) refactor that centralizes `request` behavior in `requestWithHeaders`; verified via `bun run test` (584 suites) before pushing.
- 2026-01-16: Added Google Drive status check UI in attachments with a manual refresh + re-auth flow and a dedicated test for the button behavior.
- 2026-01-16: Moved Google Drive status UI from work note attachments to sidebar user section. Added `useGoogleDriveConfigStatus` hook and updated `API.getGoogleDriveStatus` to check for configuration header. Updated tests.
- 2026-01-31: Created `createStandardMutation` factory at `apps/web/src/lib/hooks/create-standard-mutation.ts` to reduce mutation hook boilerplate from ~25 lines to ~5 lines. Supports static and dynamic (function-based) invalidateKeys. Refactored 18 mutation hooks across 6 files (use-persons, use-departments, use-projects, use-work-notes, use-task-categories, use-pdf). Kept manual implementations for hooks with optimistic updates, conditional messages, or complex logic.
