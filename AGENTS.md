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

## 2026-02-05 Drive Folder Listing Guard

### Decision/Learning
Treat empty or missing `gdrive_folder_id` as unlinked and skip Drive listing.

### Reason
Some folder records can exist without a valid ID, and listing with an empty ID triggers Drive errors.

### Impact
Normalize folder IDs before listing and return `driveFolderId`/`driveFolderLink` as null when missing.

## 2026-02-05 HWPX Zip MIME

### Decision/Learning
Special-case `application/zip` for `.hwpx` so it resolves to the HWPX MIME without relaxing other ZIP uploads.

### Reason
Some systems report HWPX files as ZIP containers, and generic ZIP acceptance would be overly broad.

### Impact
Handle ZIP only when the extension is `hwpx` instead of treating ZIP as a generic MIME type.

## 2026-02-06 Project Date/Participant Payload Compatibility

### Decision/Learning
Allow project date fields (`startDate`, `targetEndDate`, `actualEndDate`, filter dates) to accept ISO date-only strings (`YYYY-MM-DD`) as well as datetime strings.
Also accept `participantIds` as a create-project alias and normalize it to `participantPersonIds`.

### Reason
Project create/edit UI and manual API calls commonly send date-only strings and `participantIds`; strict datetime-only validation and a single participant field name caused rejected or partially applied requests.

### Impact
Keep project schema date validators date-compatible, and normalize participant payload keys in the create route so project creation behaves consistently across frontend and direct API usage.

## 2026-02-06 Participant Alias Merge Edge Case

### Decision/Learning
When supporting payload aliases for array fields, merge both arrays with `Set` instead of selecting one with `??`.

### Reason
`[]` is not nullish, so `primary ?? alias` can silently discard alias values when clients send an empty primary array.

### Impact
For participant alias handling, always combine `participantPersonIds` and `participantIds` and deduplicate before repository writes.

## 2026-02-06 Project Date Upper-Bound Filter Normalization

### Decision/Learning
When project query upper bounds (`startDateTo`, `targetEndDateTo`) are date-only strings, normalize them to a next-day exclusive comparison (`< nextDate`) instead of direct `<=`.

### Reason
Project date fields can contain datetime strings, and direct lexicographic `<= YYYY-MM-DD` excludes same-day datetime values.

### Impact
Keep repository date filters index-friendly and date-compatible by converting date-only upper bounds before SQL binding.

## 2026-02-06 AuthGate Test Retry Delay

### Decision/Learning
In `AuthGate` component tests, control React Query retry backoff with `retryDelay: 0` in the test QueryClient and avoid long `waitFor(..., { timeout: 3000 })` patterns.

### Reason
`AuthGate` sets `retry: 1` at query level, so default retry delay caused ~1s waits per error-path test and inflated suite runtime.

### Impact
Keep retry behavior coverage while forcing zero retry backoff in tests, and prefer immediate `findBy*` assertions for state transitions.

## 2026-02-07 Project File Storage Default

### Decision/Learning
When extending `project_files` for Google Drive metadata, keep `storage_type` as `TEXT NOT NULL DEFAULT 'R2'`.

### Reason
Existing project file rows are legacy R2 records, so a non-defaulted column would break backward compatibility and migrations.

### Impact
Future project file migrations/features should preserve `R2` as the implicit fallback unless data is explicitly migrated.

## 2026-02-07 Project Drive Folder Mapping

### Decision/Learning
Model `project_gdrive_folders` as one row per project by using `project_id` as the primary key with `ON DELETE CASCADE`.

### Reason
Project-level Drive folders are a 1:1 relationship, and orphan folder mappings should be removed automatically on project deletion.

### Impact
Keep project folder linking idempotent (upsert by `project_id`) and rely on relational cleanup instead of manual mapping deletes.

## 2026-02-07 Project File Drive Indexes

### Decision/Learning
Add explicit indexes on `project_files(storage_type)` and `project_files(gdrive_file_id)` when introducing Drive-backed metadata.

### Reason
Mixed R2/GDRIVE queries and Drive ID lookups are core access paths and should not depend on broader legacy indexes.

### Impact
When extending project file storage behavior, keep these Drive-specific indexes in schema migrations and migration tests.

## 2026-02-07 Project Drive Year Foldering

### Decision/Learning
Implement `GoogleDriveService.getOrCreateProjectFolder` with the same year-bucket strategy as work notes: create/find `YYYY` under `GDRIVE_ROOT_FOLDER_ID`, then place the `project_id` folder under that year.

### Reason
Project folders need deterministic Drive organization and consistent behavior with existing work note folder management.

### Impact
Reuse and re-parent existing `project_gdrive_folders` mappings into the computed year folder, and throw an explicit error when the project row is missing.

## 2026-02-07 Project File Upload Drive Fallback

### Decision/Learning
`ProjectFileService.uploadFile` now attempts Google Drive upload first, then falls back to legacy R2 storage when Drive upload cannot proceed (for example, user OAuth is not connected).

### Reason
Project file flows and existing routes/tests still need to succeed in environments where Drive env bindings exist but per-user OAuth tokens are absent.

### Impact
Persist `storage_type='GDRIVE'` plus Drive metadata on successful Drive upload, otherwise keep `storage_type='R2'` and continue normal R2 upload/embedding flow without failing the request.

## 2026-02-08 Project File Drive Config Guard

### Decision/Learning
`ProjectFileService.uploadFile` now fails fast with `CONFIGURATION_ERROR` when required Drive env vars are missing.

### Reason
Silent fallback on missing configuration hides deployment misconfiguration and makes Drive-only behavior inconsistent.

### Impact
Keep Drive env bindings (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GDRIVE_ROOT_FOLDER_ID`) mandatory for project file uploads; tests should assert the explicit configuration error path.

## 2026-02-08 Project File Storage-Aware Lifecycle

### Decision/Learning
Project file lifecycle operations are storage-type aware: `getDownloadUrl` skips R2 checks for `GDRIVE`, migration updates only legacy `R2` rows with rollback on DB failure, and project cleanup deletes linked Drive folders.

### Reason
Mixed `R2/GDRIVE` projects need deterministic branch behavior to avoid false 404s, partial migrations, and orphaned Drive folders.

### Impact
Maintain `storage_type` branching in download/delete/migrate/cleanup code paths and pass `userEmail` when invoking project cleanup that should remove Drive folders.

## 2026-02-08 Project Repository File Mapping

### Decision/Learning
Normalize `ProjectRepository.getFiles` payloads to always include `storageType` and Drive metadata fields.
For legacy rows, default `storageType` to `R2` and Drive metadata fields to `null`.

### Reason
Project detail queries can return mixed `R2/GDRIVE` files, and consumers should not infer storage from missing keys.

### Impact
Treat repository file payload shape as stable across storage backends and branch logic using `storageType`.

## 2026-02-08 Project Route Drive Payload Coverage

### Decision/Learning
For project file route integration, keep at least one unmocked `ProjectFileService` test that verifies Drive fields in the POST response.

### Reason
Service-mocked route tests can pass even when the real upload response omits Drive metadata fields.

### Impact
Use real route+service execution with Drive API fetch stubs when validating response payload contracts (`storageType`, `gdriveFileId`, `gdriveFolderId`, `gdriveWebViewLink`).

## 2026-02-08 Project File Service Payload Parity

### Decision/Learning
Keep `ProjectFileService` response fields aligned across upload and query paths by including `storageType` and Drive metadata in `mapDbToFile`.

### Reason
Route-level list/get endpoints rely on `mapDbToFile`; omitting Drive fields there creates payload shape drift versus upload responses.

### Impact
When extending project file payloads, update both upload return objects and `mapDbToFile` so route contracts stay consistent.

## 2026-02-08 Redirect Assertion in Worker Integration Tests

### Decision/Learning
For route tests that verify redirects, call `authFetch(..., { redirect: 'manual' })`.

### Reason
Default fetch redirect-following can mask the original `302` and produce misleading downstream `404` failures in Workers tests.

### Impact
Use manual redirect mode when asserting `Location` headers for Drive redirect endpoints.

## 2026-02-09 Drive Delete Integration Mock Guard

### Decision/Learning
For GDRIVE delete route integration tests, stub `DELETE https://www.googleapis.com/drive/v3/files/:id` and assert that call is made.

### Reason
Without an explicit delete stub, test fetch falls through to real Drive API calls and produces auth-driven false failures (`500` from `401`).

### Impact
Keep Drive delete mocks alongside upload/list stubs so route delete tests stay deterministic and validate the intended side effect.

## 2026-02-09 Project File Migrate Route Coverage

### Decision/Learning
Add route-level integration coverage for `POST /api/projects/:projectId/files/migrate` and require a summary response (`migrated/skipped/failed`).

### Reason
`ProjectFileService.migrateR2FilesToDrive` can exist without an exposed route; service-only tests do not guarantee API accessibility.

### Impact
Keep route integration tests for migration endpoints and assert both response summary and DB storage transition (`R2` -> `GDRIVE`).

## 2026-02-09 Project Drive Mapping Cleanup on Soft Delete

### Decision/Learning
After deleting a project Drive folder, also delete the corresponding `project_gdrive_folders` row.

### Reason
Project deletion is soft-delete only, so FK cascade does not remove folder mapping records automatically.

### Impact
Treat Drive folder cleanup as external + DB cleanup to avoid stale `project_gdrive_folders` rows after project deletion.
