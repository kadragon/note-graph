# Project Memory

## Project Overview

**Worknote Management System** - Personal work knowledge base and operational system for a single user.

### Core Architecture
- **Platform**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite-based)
- **Vector Search**: Cloudflare Vectorize
- **AI**: OpenAI GPT-4.5 + text-embedding-3-small via AI Gateway
- **Auth**: Cloudflare Access (Google OAuth)
- **Async Processing**: Cloudflare Queues
- **Storage**: Cloudflare R2 (temporary PDF storage, permanent file attachments)

### Key Design Decisions

#### 1. Search Strategy (Hybrid)
- **Lexical Search**: D1 FTS5 with trigram tokenizer for Korean partial matching
- **Semantic Search**: Vectorize with text-embedding-3-small
- **Ranking**: RRF (Reciprocal Rank Fusion) for hybrid results

#### 2. RAG Implementation
- **Chunking**: 512 tokens with 20% overlap (configurable)
- **Metadata Filtering**: person_ids, dept_name, category, created_at_bucket, project_id
- **Scope Types**: GLOBAL, PERSON, DEPT, WORK, PROJECT
- **Constraint**: Vectorize metadata string fields limited to 64 bytes

#### 3. PDF Processing Pipeline
- **Flow**: Upload → Queue → R2 → unpdf extraction → AI draft → cleanup
- **Storage Policy**: Temporary only, TTL 1 day or immediate deletion after processing
- **Async Pattern**: Queue-based to avoid Worker timeout

#### 4. Recurrence Logic
- **Types**: DUE_DATE (next due = previous due + interval), COMPLETION_DATE (next due = completion date + interval)
- **Generation**: New instance created on completion of current todo

#### 5. Version Management
- Keep latest 5 versions only
- Auto-purge oldest when inserting 6th version

#### 6. Naming Convention
- **Standard**: kebab-case for all files (components, hooks, pages, utilities, tests)
- **No exceptions**: React components also use kebab-case (not PascalCase)

## Session History Summary

### Initial Implementation (Sessions 1-23, 2025-11-18 to 2025-11-21)
- **Infrastructure**: Wrangler setup, D1 schema, authentication, API structure
- **Core Entities**: Person, Department, WorkNote (with versioning), Todo (with recurrence)
- **AI Features**: RAG pipeline, chunking, AI draft generation, PDF processing
- **Testing**: Vitest with Workers pool, coverage configuration
- **Frontend**: Vanilla JS SPA with 7 main pages, Korean localization
- **UX Improvements**: Department selector, person form validation, debounced search
- **Retry Mechanism**: Embedding retry queue with exponential backoff

### AI & Collaboration Features (Sessions 24-27, 2025-11-24)
- **AI Draft References**: Transparency for AI context, reference tracking in drafts
- **PDF Draft References**: Extended PDF flow with reference selection
- **Todo Patterns**: AI suggestions include todo patterns from similar notes
- **Code Refactoring**: Extracted common AI draft editing logic (62% reduction)

### UI/UX Polish (Sessions 28-32, 2025-11-24 to 2025-11-25)
- **Todo Wait/Due Alignment**: Wait dates as primary UI element
- **Work Notes List**: Added persons column with department display
- **Detail View**: Quick-edit triggers, sticky save buttons, improved spacing
- **Accessibility**: ARIA labels, focus management with user feedback

### Project Management (Sessions 33-38, 2025-11-26)
- **Database**: 4 new tables (projects, project_participants, project_work_notes, project_files)
- **Repository & API**: Full CRUD with filtering, soft delete, participant management
- **File Management**: R2 storage, upload/download, 50MB limit, MIME validation
- **RAG Extension**: PROJECT scope filtering with projectId metadata
- **File Embedding**: Synchronous text extraction and embedding for PDF/TXT files
- **Testing**: 32 unit tests, 23 integration tests for project features

### Statistics & Analytics (Sessions 46-49, 2025-11-30)
- **Backend**: StatisticsRepository with period filtering, completion tracking
- **Frontend**: Recharts integration, summary cards, distribution charts, work notes table
- **Testing**: 38 comprehensive tests (date utils, repository, routes)
- **Fixes**: Todo completion timestamp filtering, year parameter respect

### Todo UX Improvements (Sessions 42, 49, 2025-11-28 to 2025-12-01)
- **Dashboard Grouping**: Group todos by work note in remaining tab
- **Wait Date Filtering**: Consistent wait_until handling across all views
- **Completion Display**: Show completion date for completed todos
- **Recurring Grouping**: Group recurring todos in work note detail (expand/collapse)
- **Tests**: 9 unit tests for recurring todo grouping logic

### Person Management (Sessions 45, 50-51, 2025-11-28 to 2025-12-01)
- **List Ordering**: Reordered columns (dept → name → position → ID → phone → created)
- **Searchable Selector**: cmdk-based assignee selector with multi-select
- **Edit Dialog**: Shared PersonDialog component supporting create/edit modes
- **Department Search**: Debounced search with loading/error states

### Repository Structure (Sessions 53-56, 2025-12-05)
- **Apps/Packages Layout**: Backend → apps/worker, Frontend → apps/web, Shared → packages/shared
- **Path Aliases**: Clear separation (@worker/* for backend, @web/* for frontend)
- **Build Output**: dist/web for frontend, dist/worker for backend
- **Tsconfig**: Moved to app roots with shared tsconfig.base.json
- **Worker Layout**: Reverted to apps/worker/src (kept traditional structure)

### Session 57: Naming Convention Standardization (2025-12-05)
- **TASK-055 (SPEC-devx-naming-1)**: Enforced kebab-case for all frontend files and fixed all imports/exports; verified lint/typecheck/build.
- **Note**: macOS case-insensitivity can mask casing issues; verify with `tsc` and a clean build.

### Session 58: Test Import Path Fix (2025-12-06)
- **TASK-056 (SPEC-devx-naming-1)**: Fixed a case-sensitive import path in a test to unblock Linux builds.

### Session 59: Work Note File Attachments (2025-12-08)
- **TASK-057 (SPEC-worknote-attachments-1)**: Added work note attachments (upload/list/stream/delete) backed by R2 and `work_note_files`.
- No auto-extraction/embedding for work note files (unlike project files); 50MB limit; allowlist of common doc/image types.
- Verified via unit tests plus typecheck/build.

### Session 60: HWPX MIME Fallback (2025-12-08)
- **TASK-058 (SPEC-worknote-attachments-1)**: Enabled extension-based MIME resolution so HWPX files upload even when browsers omit or send generic MIME types; keeps rejection for explicit unsupported MIME values. Added unit test covering empty MIME HWPX upload.

### Session 61: Todo Wait Until Logic Fix (2025-12-08)
- Treated `wait_until` as a strict "hidden until" gate (`wait_until` > `now` => hidden); added a unit regression test.

### Session 62: PDF Auto-Attachment (2025-12-08)
- **TASK-062 (SPEC-pdf-1)**: When creating a work note from a PDF draft, automatically attach the original PDF; warn if attachment fails after work note creation.

### Session 63: Work Note Attachment Ordering (2025-12-10)
- **TASK-063 (SPEC-worknote-attachments-1)**: Sorted work note attachments by `uploadedAt` (newest first) with `fileId` tie-breaker for deterministic UI ordering.
- Added shared helper `sortFilesByUploadedAtDesc` plus 2 unit tests to enforce ordering and tie-break behavior.

### Session 64: Work Note Attachment Recency Badge (2025-12-10)
- **TASK-064 (SPEC-worknote-attachments-1)**: Added "오늘 업로드" badge for attachments uploaded on the current local day; shared `isUploadedToday` helper with unit coverage.
- Badge sits alongside actions, preserving deterministic ordering and improving recency visibility.

### Session 65: Project soft delete detaches work notes (2025-12-14)
- **TASK-065 (SPEC-project-1)**: Fixed stale `project_work_notes` links surviving project soft delete, which caused false `CONFLICT` on reassignment.
- **Implementation**: On project delete, remove `project_work_notes` rows and clear `work_notes.project_id`; on assignment, ignore/clean stale links to deleted projects.
- **Migration**: Added `0018_cleanup_soft_deleted_project_work_note_links.sql` to clean existing stale data.
- **Verification**: `npm test` passed.

### Session 66: Work Note File Inline Preview (2025-12-14)
- **TASK-066 (SPEC-worknote-attachments-1)**: Added work note attachment preview via `/work-notes/:workId/files/:fileId/view` with `Content-Disposition: inline`.
- **Frontend**: Added "바로보기" button for previewable file types (PDF, images) opening a new tab.
- **Verification**: Added unit + integration tests for inline streaming behavior; `npm run typecheck` passed.

### Session 67: Statistics Date Range Bug Fix & Performance Optimization (2025-12-16)
- **TASK-067 (SPEC-stats-1, TEST-stats-7)**: Fixed recurring-todo statistics overcount by switching correlated subqueries to a date-filtered CTE aggregation; all tests green.

### Session 68: Search Page Unified Request Loop Fix (2025-12-16)
- **TASK-068 (SPEC-search-ui-1)**: Fixed /search effect causing repeated unified search requests by normalizing the URL query and guarding per query value; added unit test; all tests green.

## Known Issues

### AI Gateway Binding in Tests

### Coverage in Workers Pool
- **Issue**: `@vitest/coverage-v8` requires `node:inspector` (unsupported in workerd)
- **Status**: Coverage collection blocked in Workers environment
- **Workaround**: Rely on targeted test coverage without coverage numbers

## Technical Debt
- Consider implementing proper tokenizer library (e.g., tiktoken) instead of character-based approximation
- Vectorize deleteWorkNoteChunks uses workaround (query + delete) instead of native prefix deletion
- Future: Background retry processor using Cloudflare Cron Triggers for automatic retry queue processing

## Lessons Learned
- **Async Patterns**: Async embedding prevents blocking CRUD while ensuring eventual consistency
- **Korean Text**: Character-based tokenization (~4 chars/token) works well for Korean/English
- **Retry Pattern**: Exponential backoff with dead-letter queue provides robust eventual consistency
- **Focus Management**: Should provide user feedback when automatic focus fails
- **Accessibility**: ARIA labels essential for interactive UI elements without visible text
- **CSS Documentation**: Magic numbers should be documented with context and rationale
- **Test Assertions**: Behavioral test assertions work better than mocked dates in Workers environment
- **Task Tracking**: Must update task tracker immediately after completing implementation
- **Naming Consistency**: Enforce single naming convention (kebab-case) across all files for better maintainability
- **Import Path Case Sensitivity**: Always use exact case in imports to ensure Linux/Windows compatibility
- **Statistics Date Filtering**: Always apply date range filters to aggregate subqueries, not just WHERE clauses, to avoid counting historical data in period-based reports
- **SQL Performance**: Prefer CTEs over correlated subqueries for aggregations; pre-filter and aggregate in CTE, then join for better scalability
<!-- Trace: spec_id=SPEC-governance-1, task_id=TASK-059 -->
<!-- Trace: spec_id=SPEC-worknote-attachments-1, task_id=TASK-063 -->
<!-- Trace: spec_id=SPEC-worknote-attachments-1, task_id=TASK-064 -->
<!-- Trace: spec_id=SPEC-worknote-attachments-1, task_id=TASK-066 -->
<!-- Trace: spec_id=SPEC-stats-1, task_id=TASK-067 -->
