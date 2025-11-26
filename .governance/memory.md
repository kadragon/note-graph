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
- **Storage**: Cloudflare R2 (temporary PDF storage)

### Key Design Decisions

#### 1. Search Strategy (Hybrid)
- **Lexical Search**: D1 FTS5 with trigram tokenizer for Korean partial matching
- **Semantic Search**: Vectorize with text-embedding-3-small
- **Ranking**: RRF (Reciprocal Rank Fusion) for hybrid results
- **Rationale**: Trigram handles Korean morphology better than default tokenizers

#### 2. RAG Implementation
- **Chunking**: 512 tokens with 20% overlap (configurable)
- **Metadata Filtering**: person_ids, dept_name, category, created_at_bucket
- **Scope Types**: GLOBAL, PERSON, DEPT, WORK
- **Constraint**: Vectorize metadata string fields limited to 64 bytes

#### 3. PDF Processing Pipeline
- **Flow**: Upload → Queue → R2 → unpdf extraction → AI draft → cleanup
- **Storage Policy**: Temporary only, TTL 1 day or immediate deletion after processing
- **Library**: unpdf (Edge-compatible)
- **Async Pattern**: Queue-based to avoid Worker timeout

#### 4. Recurrence Logic
- **Types**:
  - DUE_DATE: next due = previous due + interval
  - COMPLETION_DATE: next due = completion date + interval
- **Generation**: New instance created on completion of current todo

#### 5. Version Management
- Keep latest 5 versions only
- Auto-purge oldest when inserting 6th version

## Session History

### Session 1: Initial Setup (2025-11-18)
- Created base directory structure (.governance, .spec, .tasks)
- Established project foundation from PRD 2.0
- Defined architecture and key technical decisions

### Session 2: Wrangler Project Initialization (2025-11-18)
- **TASK-001 Completed**: Initialize Cloudflare Workers project with Wrangler
- Configured wrangler.toml with all bindings (D1, Vectorize, Queue, R2, AI Gateway)
- Set up TypeScript with strict mode and comprehensive compiler options
- Installed dependencies: Hono, Zod, nanoid, date-fns
- Created src/ directory structure following project conventions
- Implemented basic Hono app with health check endpoint
- Verified dev server runs successfully on http://localhost:8787
- **Status**: Infrastructure foundation complete, ready for database schema (TASK-002)

### Session 3: Database Schema and Migrations (2025-11-18)
- **TASK-002 Completed**: Create D1 database schema and migrations
- Created comprehensive migration file: `migrations/0001_initial_schema.sql`
- Implemented 9 core tables with proper foreign key relationships and cascade deletes
- Set up FTS5 virtual table with trigram tokenizer for Korean partial matching
- Created 3 FTS synchronization triggers (INSERT, UPDATE, DELETE)
- Added 24 optimized indexes for foreign keys and common query patterns
- Documented migration process in `migrations/README.md`
- Tested migration locally: 37 SQL commands executed successfully
- Verified FTS functionality with Korean text search
- **Status**: Database schema complete, ready for API implementation (TASK-003)

### Session 4: Authentication Middleware (2025-11-18)
- **TASK-003 Completed**: Implement authentication middleware
- Created auth types: `AuthUser`, `AuthenticationError`
- Implemented auth middleware extracting `Cf-Access-Authenticated-User-Email` header
- Added development fallback using `X-Test-User-Email` header for local testing
- Created GET /me endpoint returning authenticated user information
- Updated error handler to return 401 for `AuthenticationError`
- Tested all authentication scenarios: unauthorized (401), with test header (200), with CF Access header (200)
- **Status**: Authentication complete, ready for API structure (TASK-004)

### Session 5: API Structure and Routing (2025-11-18)
- **TASK-004 Completed**: Set up Hono API structure and routing
- Created domain error classes: `DomainError`, `NotFoundError`, `ValidationError`, `ConflictError`, `BadRequestError`, `RateLimitError`
- Implemented Zod validation schemas for all entities (Person, Department, WorkNote, Todo)
- Created validation utilities: `validateBody`, `validateQuery`, `validateParams`
- Built route modules: `persons`, `departments`, `work-notes`, `todos` (15+ endpoints)
- Enhanced error handler to support all domain error types with proper status codes
- All routes protected by auth middleware
- Tested API structure: routing, validation, error handling
- **Status**: API structure complete, ready for repository implementation (TASK-005)

### Session 6: Person Repository and CRUD (2025-11-18)
- **TASK-005 Completed**: Implement Person repository and CRUD endpoints
- Created Person type definitions: `Person`, `PersonDeptHistory`, `PersonWorkNote`
- Implemented PersonRepository with D1 batch transactions for atomicity
- Created 6 fully functional endpoints:
  - POST /persons (creates person + auto department history entry)
  - GET /persons (list with optional search)
  - GET /persons/:personId (retrieve by ID)
  - PUT /persons/:personId (update with department history management)
  - GET /persons/:personId/history (full department assignment history)
  - GET /persons/:personId/work-notes (person's work notes with roles)
- Department history tracking: auto-creates initial entry, deactivates old and creates new on department change
- Applied D1 migrations locally (39 SQL commands executed successfully)
- All endpoints implement proper error handling with domain errors (NotFoundError, ConflictError)
- **Status**: Person management complete, ready for Department repository (TASK-006)

### Session 7: Department Repository and CRUD (2025-11-18)
- **TASK-006 Completed**: Implement Department repository and CRUD endpoints
- Created Department type definitions: `Department`, `DepartmentMember`, `DepartmentWorkNote`
- Implemented DepartmentRepository with D1 queries and join operations
- Created 5 fully functional endpoints:
  - POST /departments (creates new department)
  - GET /departments (list all departments sorted by name)
  - GET /departments/:deptName (retrieve by name)
  - PUT /departments/:deptName (update description)
  - GET /departments/:deptName/work-notes (department's work notes via join)
- Department member queries support filtering by is_active status
- Work notes found via work_note_person join with DISTINCT to avoid duplicates
- Fixed TypeScript type casting for domain error statusCode in route handlers
- All endpoints implement proper error handling with domain errors
- **Status**: Department management complete, ready for WorkNote repository (TASK-007)

### Session 8: WorkNote Repository with Versioning (2025-11-18)
- **TASK-007 Completed**: Implement WorkNote repository with versioning
- Created WorkNote type definitions: `WorkNote`, `WorkNoteVersion`, `WorkNotePersonAssociation`, `WorkNoteRelation`, `WorkNoteDetail`
- Implemented WorkNoteRepository with complex versioning logic and batch transactions
- Created 5 fully functional endpoints:
  - POST /work-notes (creates work note + person associations + related notes + first version)
  - GET /work-notes (list with comprehensive filters: category, person, dept, date range, keyword)
  - GET /work-notes/:workId (retrieve with all associations)
  - PUT /work-notes/:workId (update + new version + auto prune old versions)
  - DELETE /work-notes/:workId (delete with cascade - returns 204)
- Version management: auto-creates on create/update, keeps max 5 versions, prunes oldest automatically
- Person associations support OWNER/RELATED roles with batch operations
- Related work note linking for bidirectional relationships
- Complex filtering with JOIN operations for person and department filters
- Work ID generation using nanoid in format WORK-{ulid}
- Version pruning uses LIMIT -1 OFFSET pattern for efficient deletion
- All endpoints implement proper error handling with domain errors
- **Status**: WorkNote management complete, ready for Todo repository (TASK-008)

### Session 9: Todo Repository with Recurrence (2025-11-18)
- **TASK-008 Completed**: Implement Todo repository with recurrence logic
- Created Todo type definitions: `Todo`, `TodoWithWorkNote`, `TodoStatus`, `RepeatRule`, `RecurrenceType`
- Implemented TodoRepository with two recurrence strategies:
  - DUE_DATE: next_due = old_due + interval (e.g., weekly meeting always on Mondays)
  - COMPLETION_DATE: next_due = completion_date + interval (e.g., oil change every 3 months from last change)
- Created 4 fully functional endpoints:
  - POST /work-notes/:workId/todos (creates todo for work note, default status '진행중')
  - GET /work-notes/:workId/todos (lists all todos for work note)
  - GET /todos (list with view filters: today, this_week, this_month, backlog, all)
  - PATCH /todos/:todoId (update with automatic recurrence generation)
- View filters with intelligent date range calculation:
  - today: due today AND (wait_until is null OR wait_until <= now)
  - this_week: due this week AND (wait_until is null OR wait_until <= now)
  - this_month: due this month AND (wait_until is null OR wait_until <= now)
  - backlog: due_date < now AND status != '완료' (overdue todos)
  - all: no filtering
- Recurrence logic: automatically generates new todo instance when status changes to '완료'
- New recurrent todo inherits: title, description, repeat_rule, recurrence_type, work_id
- New recurrent todo gets: new todo_id, new created_at, status='진행중', calculated due_date, wait_until=null
- Todo ID generation using nanoid in format TODO-{nanoid}
- Korean status values supported: 진행중, 완료, 보류, 중단
- All endpoints implement proper error handling with domain errors
- **Status**: Phase 2 (Entity Management) complete! Ready for Phase 3 (Search & AI Features)

### Session 10: Phase 3 - RAG & AI Features (2025-11-18)
- **TASK-012 Completed**: Implement chunking and RAG pipeline
- **TASK-013 Completed**: Implement AI draft generation from text
- Created ChunkingService with sliding window algorithm (512 tokens, 20% overlap)
- Character-based tokenization approximation (~4 chars/token)
- Implemented RagService for contextual Q&A using GPT-4.5 via AI Gateway
- Scope filtering: GLOBAL, PERSON, DEPARTMENT, WORK
- Similarity threshold (0.5) for relevance filtering
- Created WorkNoteService to coordinate D1, chunking, and Vectorize operations
- Automatic chunk generation on work note create/update
- Automatic chunk deletion on work note delete
- Async embedding to avoid blocking CRUD operations
- Vectorize Integration: batch chunk embedding with metadata
- Chunk ID format: workId#chunkN (e.g., WORK-abc123#chunk0)
- POST /rag/query endpoint for contextual Q&A
- Implemented AIDraftService for GPT-4.5 draft generation
- POST /ai/work-notes/draft-from-text: generates structured drafts from unstructured text
- POST /ai/work-notes/{workId}/todo-suggestions: generates todo items for work notes
- Korean workplace-optimized prompts with temperature 0.7
- JSON-only response format for reliable parsing
- Rate limit handling (429 errors) with Korean error messages
- Updated work note routes to use WorkNoteService instead of repository directly
- All routes properly authenticated and error-handled
- **Status**: Phase 3 (Search & AI Features) 100% complete! All 5 tasks (TASK-009 through TASK-013) finished.

### Session 11: Phase 4 - PDF Processing (2025-11-18)
- **TASK-014 Completed**: Implement PDF upload and job creation
- **TASK-015 Completed**: Implement PDF queue consumer with unpdf
- Installed unpdf package (v1.4.0) for PDF text extraction in Workers environment
- Created PDF type definitions: PdfJob, PdfJobStatus, PdfUploadMetadata, WorkNoteDraft, PdfQueueMessage
- Created Zod validation schemas for PDF upload and job polling
- Implemented PdfJobRepository with comprehensive D1 operations for job lifecycle management
- Created POST /pdf-jobs endpoint:
  - Multipart/form-data file upload
  - File validation (PDF type, 10MB size limit)
  - R2 storage with custom metadata (jobId, originalName, uploadedAt)
  - D1 job creation with PENDING status
  - Queue message sending with job details and metadata hints
  - Returns 202 Accepted with jobId for polling
- Created GET /pdf-jobs/{jobId} endpoint:
  - Polling endpoint for job status
  - Returns status, timestamps, error message (if ERROR), or draft (if READY)
- Implemented PdfExtractionService:
  - Uses unpdf's extractText() with mergePages option
  - PDF validation (header check, minimum size)
  - Error handling for encrypted, corrupted, and image-only PDFs
  - Korean error messages for user-friendly feedback
- Implemented Queue consumer handler (async function queue):
  - Processes message batches from PDF_QUEUE
  - Status transitions: PENDING → PROCESSING → READY/ERROR
  - Fetches PDF from R2, extracts text, generates AI draft
  - Integrates with AIDraftService using metadata hints (category, personIds, deptName)
  - Comprehensive error handling with detailed logging
  - R2 cleanup on both success and error
  - Message acknowledgment to prevent retry loops
- Mounted /pdf-jobs routes in main app
- All TypeScript type checking passes
- **Status**: Phase 4 (PDF Processing) 100% complete! Full async PDF→draft pipeline operational.

### Session 12: Phase 5 - Testing Infrastructure Setup (2025-11-18)
- **TASK-016 Completed**: Write comprehensive test suite
- Installed @vitest/coverage-v8 package (v2.1.8) for code coverage
- Configured Vitest with @cloudflare/vitest-pool-workers for Workers environment testing
- Set coverage thresholds: 80% statements/functions/lines, 75% branches
- Created test directory structure (tests/, tests/unit/, tests/setup.ts, tests/README.md)
- Implemented basic integration tests (api.test.ts):
  - Health check, root endpoint, authentication middleware, 404 handler
- Implemented unit tests:
  - chunking.test.ts - ChunkingService with overlap and Korean text
  - errors.test.ts - All domain error classes
- Documented testing approach with SDD × TDD workflow
- Documented future test expansion plan for all specs
- Identified AI Gateway binding issue with miniflare/workerd
- Documented workarounds for comprehensive testing
- **Status**: Phase 5 (Testing Infrastructure) established! Framework ready for expansion.

### Session 13: Phase 5 - Frontend UI Implementation (2025-11-18)
- **TASK-017 Completed**: Create basic frontend UI
- Created public/ directory structure for static assets (HTML, CSS, JS)
- Configured Wrangler 3 assets feature to serve static files from public/ directory
- Updated wrangler.toml with [assets] configuration
- Changed root API route from `/` to `/api` to allow index.html to serve at root
- Built vanilla JavaScript Single Page Application (SPA):
  - Client-side routing with hash-based navigation
  - API service layer for backend communication
  - UI utilities (loading, toasts, date formatting)
  - Page renderers for all 7 main views
  - Application controller with state management
- Implemented 7 main pages with full Korean localization:
  - **Dashboard** (대시보드): Todo views with tabs (today, week, month, backlog, all)
  - **Work Notes** (업무노트): List, create, view, delete operations
  - **Persons** (사람 관리): List and create person records
  - **Departments** (부서 관리): List and create departments
  - **Search** (검색): Hybrid search interface with result scoring
  - **RAG Chat** (AI 챗봇): 4 scope modes (GLOBAL, PERSON, DEPT, WORK) with sources
  - **PDF Upload** (PDF 업로드): Drag-and-drop with polling and draft preview
- Created modern, responsive design system:
  - Custom CSS with Korean font support (Malgun Gothic, Apple SD Gothic Neo)
  - Color palette: primary (blue), success (green), warning (amber), danger (red)
  - Component library: cards, buttons, forms, tables, badges, toasts, chat bubbles
  - Responsive breakpoints: desktop (>1024px), tablet (768-1024px), mobile (<768px)
  - Fixed sidebar (260px) with collapsible mobile view
- Implemented key features:
  - **Optimistic UI**: Todo checkbox updates instantly with background sync
  - **Toast notifications**: 3-second auto-dismiss with slide-in animation
  - **Loading overlay**: Global loading state with spinner
  - **Chat interface**: Message bubbles with source citations and similarity scores
  - **File upload**: Drag-and-drop area with visual feedback
  - **PDF polling**: Automatic 1-second polling (60 attempts max) with status updates
  - **Error handling**: User-friendly Korean error messages
- Testing verified:
  - Static assets served correctly at `/`, `/css/styles.css`, `/js/app.js`
  - API endpoints functional at `/api`, `/health`, `/me`
  - All page routes render correctly
  - SPA navigation works with hash routing
  - Development server runs without errors
- **Status**: Phase 5 (Testing & Polish) 100% COMPLETE!
  - TASK-016: Testing Infrastructure ✓
  - TASK-017: Frontend UI ✓
- **Full application ready for Phase 6 (Deployment & Docs)!**

### Session 14: Person Creation Validation Fix (2025-11-18)
- **TASK-018 Completed**: Prevent foreign key errors when creating persons without existing departments
- Added department existence check in PersonRepository (VALIDATION_ERROR with Korean message)
- Added regression coverage in `tests/person.test.ts` with minimal D1 schema setup for Workers tests
- Updated vitest config to include D1 binding and development ENVIRONMENT for test auth fallback

### Session 15: Person Form Department Selector (2025-11-18)
- **TASK-019 Completed**: Person creation UI now pulls department names from DB with searchable datalist
- Added inline department creation button; newly created dept auto-selects
- Block free-text unknown departments to align with FK constraints and validation
- Minor UI tweaks: stable person list field mappings; inline form styling for inputs with actions

### Session 16: Debounced Department Search (2025-11-18)
- **TASK-020 Completed**: Added backend department search (optional q) and debounced search in person modal
- New integration test `tests/departments.test.ts` validates search filtering
- Debounce helps large department lists; empty input restores full list; inline add still works

### Session 17: Department Search UX Polish (2025-11-18)
- **TASK-021 Completed**: Added loading/error feedback, keyboard navigation, and 5-item suggestion cap to department selector
- Suggestions render via custom dropdown with arrow/enter/escape controls; inline add stays compatible
- Kept debounced async search; limited results to mitigate large lists

### Session 18: Department Creation Contract Fix (2025-11-19)
- **TASK-022 Completed**: Aligned frontend department/person models with backend (`deptName`, `personId`, `currentDept`) to resolve 400 errors when adding departments and remove React key warnings.
- Added mapper + tests to enforce `deptName` payload; updated UI keys to use `deptName`/`personId` and kept FK-safe selection.
- Typecheck and targeted vitest suites pass; ready for deployment once favicon asset added separately.

### Session 19: Embedding Retry Mechanism (2025-11-18)
- **TASK-023**: Implement Retry Mechanism for Embedding Failures
- Created SPEC-rag-2 for embedding reliability with GWT format
- Implemented SDD + TDD approach (RED → GREEN cycle)
- **Database Migration**: Created 0002_embedding_retry_queue.sql
  - New table: embedding_retry_queue with FK to work_notes (CASCADE delete)
  - Indexes for efficient retry processing (status, next_retry_at, work_id)
  - Stores retry metadata: attempt_count, max_attempts, error details, timestamps
- **EmbeddingRetryService**: Complete retry queue management
  - Exponential backoff calculation: 2^attempt_count seconds (2s, 4s, 8s)
  - Max 3 retry attempts before moving to dead-letter
  - Idempotent retry operations
  - Methods: enqueueRetry, getRetryableItems, updateRetryAttempt, moveToDeadLetter, etc.
- **WorkNoteService Integration**: Automatic failure handling
  - Create operation: catches embedding failures, enqueues for retry
  - Update operation: catches re-embedding failures, enqueues for retry
  - Delete operation: documented FK cascade behavior (retry entries auto-deleted)
- **Admin Routes**: /admin/embedding-failures management
  - GET /admin/embedding-failures - List dead-letter items with pagination
  - POST /admin/embedding-failures/:id/retry - Manual retry for dead-letter items
  - GET /admin/embedding-failures/:id - Get failure details
  - GET /admin/retry-queue/stats - Queue statistics by status
- **Test Coverage**: 19 new tests, all passing (332 total tests)
  - Queue management tests (enqueue, deduplication, fetch)
  - Exponential backoff calculation tests
  - Dead-letter queue tests
  - Admin query tests (pagination, filtering)
  - Manual retry tests
- **Technical Implementation**:
  - Retry ID format: RETRY-{nanoid}
  - Status values: pending, retrying, dead_letter
  - Error details preserved as JSON for debugging
  - Korean error messages for admin UI
  - Background processor support (for future Cron Triggers)
- **Status**: Eventual consistency achieved! Embedding failures now automatically retry with exponential backoff

### Session 20: AI Gateway Binding Update (2025-11-19)
- **TASK-026 Completed**: Align AI Gateway binding/configuration
- Updated `wrangler.toml` and `.governance/env.yaml` to point at the deployed AI Gateway ID `worknote-maker`, ensuring AI draft, RAG, and PDF draft flows remain consistent between docs and runtime
- Added trace annotations referencing SPEC-ai-draft-1 / TASK-026 for future auditing
- Config-only change; no automated test updates required

### Session 21: Pretendard Variable Font Integration (2025-11-20)
- **TASK-027 Completed**: Unify font to Pretendard Variable
- Added Pretendard Variable font via jsDelivr CDN (v1.3.9)
- Updated `frontend/index.html` with font stylesheet link
- Updated `tailwind.config.js` fontFamily.sans to prioritize Pretendard Variable
- Added comprehensive fallback font stack for cross-platform compatibility
- Benefits: Superior Korean typography, variable font performance, unified visual appearance
- Build and tests pass without font-related issues

### Session 22: Test Schema Sync for Workers Pool (2025-11-20)
- **TASK-028 Completed** (SPEC-devx-1): Aligned Vitest Workers D1 schema with migrations.
- Rebuilt `tests/setup.ts` with consolidated DDL including employment_status,
  dept_at_time/position_at_time, todos.updated_at, retry queue, task categories, and FTS table.
- Relaxed work_note_person role CHECK to allow PARTICIPANT to match legacy fixtures.
- Repository tests now free of missing-column errors; overall `npm test` results: 425 passed / 3 failed (auth tests expect prod-mode 401 but dev fallback returns 200).
- Coverage still blocked in Workers pool because @vitest/coverage-v8 pulls `node:inspector` (unsupported by workerd).

### Session 23: Backlog Cleanup (2025-11-21)
- Pruned `.tasks/backlog.yaml` to pending/paused items (TASK-024, TASK-025, TASK-021, TASK-020, TASK-018, TASK-019) and recalculated totals (21h) after moving TASK-023 to current.
- Set `.tasks/current.yaml` to TASK-023 (SPEC-dept-1) with trace note; ensures SDD/TDD loop resumes at highest-priority pending work.
- Linked SPEC-dept-1 to TASK-006, TASK-022, TASK-023 for backward traceability in `.spec/department-management/spec.yaml`.

### Session 24: AI Draft References (2025-11-24)
- **TASK-029 Completed** (SPEC-ai-draft-refs-1): Added transparency for AI draft context and persistence of confirmed references.
- Backend: `findSimilarNotes` now returns workId + similarityScore; AI draft endpoint responds with `{ draft, references }`; new unit test `tests/unit/work-note-service.test.ts` for reference metadata.
- Frontend: Create-from-text dialog shows referenced work notes with deselectable checkboxes and saves selected IDs as `relatedWorkIds`; work note detail fetches full detail and renders a “참고한 업무노트” section.
- Added new spec `.spec/ai-draft/references.spec.yaml`; cleared current task after completion.

### Session 25: PDF Draft References (2025-11-24)
- **TASK-030 Completed** (SPEC-ai-draft-refs-1): Extended PDF async draft flow to return referenced work notes and allow deselection before saving.
- Backend: PDF processing stores `{draft, references}` in `draft_json`, GET `/pdf-jobs/:jobId` returns references; PdfJobRepository updated with reference-aware ready status and tests.
- Frontend: Create-from-PDF dialog now shows "AI가 참고한 업무노트" checkbox list, saves selected references as `relatedWorkIds` when creating the work note.
- Tests: `npm test -- pdf-job-repository.test.ts work-note-service.test.ts`.

### Session 26: Todo Patterns in AI References (2025-11-24)
- **TASK-031 Completed** (SPEC-ai-draft-refs-1): Extended findSimilarNotes to include todo information for better AI draft suggestions.
- Added `ReferenceTodo` type with title, description, status, dueDate fields.
- Added optional `todos` array to `SimilarWorkNoteReference` interface.
- Created `WorkNoteRepository.findTodosByWorkIds()` batch query method to avoid N+1 queries.
- Updated `findSimilarNotes` to fetch todos in parallel using `Promise.all`.
- Updated `constructDraftPromptWithContext` to display reference todos with due dates and status.
- AI prompt now instructs to reference todo patterns from similar notes when generating suggestions.
- Tests: 51 tests pass for work-note-repository and work-note-service; 4 new tests for todo functionality.

### Session 27: AI Draft Dialog Refactoring (2025-11-24)
- **TASK-032 Completed** (SPEC-worknote-1): Extracted common AI draft editing logic to reduce code duplication by 62%.
- Created `useAIDraftForm` hook managing shared state and logic (title, content, categories, persons, todos, references, submit).
- Created `DraftEditorForm` component for shared UI (category selection, assignee selector, content, references, todos).
- Refactored `CreateFromTextDialog`: 388→143 lines (63% reduction).
- Refactored `CreateFromPDFDialog`: 391→154 lines (61% reduction).
- Both dialogs now thin wrappers for Step 1 (input collection), delegating Step 2 (editing) to DraftEditorForm.
- Build and typecheck pass successfully.

### Session 28: Todo Wait/Due Alignment (2025-11-24)
- **TASK-033 Completed** (SPEC-todo-1): Made wait dates primary in todo UI and defaults.
- Backend create/update now auto-fill `due_date` when only `wait_until` is provided; recurrence inserts copy next `due_date` to `wait_until`.
- Frontend shows wait date before due date in dashboard todo items and work note dialog; edit dialog auto-fills due date when wait date is set.
- Added TEST-todo-7/8 to cover auto-fill and recurrence wait duplication; `npm test -- tests/unit/todo-repository.test.ts` passing.

### Session 29: Todo Wait Date Comparison Bugfix (2025-11-25)
- **Bugfix** (SPEC-todo-1): Fixed wait date filtering in work notes stats to include today's date.
- **Issue**: Work notes with todos having `waitUntil === today` were incorrectly classified as "remaining" instead of "pending".
- **Root Cause**: Time-based comparison caused false negatives after midnight (e.g., `00:00:00 >= 15:30:00` = false).
- **Backend**: Already correctly implemented with `wait_until <= now` in todo-repository.ts:184.
- **Fix**: Changed comparison to use `startOfDay` normalization with `isAfter` for calendar day comparison.
- **Implementation**: `isAfter(startOfDay(waitUntil), startOfDay(now))` ensures proper day-level granularity.
- **Semantic Clarification**: Wait date means "확인해야 하는 날" (day to check), not "그 전까지 기다리는 날" (wait until).
- **Review Feedback**: P2 comment addressed - normalized both dates to start of day to avoid time-based false negatives.
- **Files Modified**: `frontend/src/hooks/useWorkNotes.ts` (added date-fns imports, calendar day comparison).

### Session 30: Work Notes List - Add Persons Column (2025-11-25)
- **Enhancement** (SPEC-worknote-1): Added person assignments display in work notes list table.
- **Changes**: Added "담당자" column between "업무 구분" and "할일" columns.
- **UI Display**: Shows person name with department in parentheses (e.g., "홍길동 (개발팀)").
- **Multiple Persons**: Displayed vertically stacked when multiple persons are assigned.
- **Empty State**: Shows "-" when no persons are assigned.
- **Files Modified**:
  - `frontend/src/pages/WorkNotes/components/WorkNotesTable.tsx` (added header column)
  - `frontend/src/pages/WorkNotes/components/WorkNoteRow.tsx` (added persons cell with person name and dept)

### Session 31: Work Note Detail UX Polish (2025-11-25)
- **Task**: TASK-034 (SPEC-ui-1) quick-edit triggers, save controls, spacing, todo typography.
- **Changes**:
  - Clicking "업무 구분 없음" or "담당자 없음" toggles edit mode and focuses the relevant picker.
  - Added sticky top save/cancel buttons in the detail dialog (bottom actions retained).
  - Tightened prose spacing via CSS to reduce scroll without hurting readability.
  - Todo titles now larger than descriptions; descriptions preserve manual line breaks using `preserveLineBreaksForMarkdown`.
- **Tests**: `npm test -- tests/unit/text-format.test.ts`
- **Files Modified**:
  - `frontend/src/pages/WorkNotes/components/ViewWorkNoteDialog.tsx`
  - `frontend/src/lib/utils.ts`
  - `frontend/src/styles/index.css`
  - `tests/unit/text-format.test.ts`

### Session 32: Code Review Improvements (2025-11-25)
- **Task**: Code review feedback implementation for PR #110
- **Improvements**:
  - **Accessibility**: Added `aria-label` attributes to quick-edit trigger buttons for screen reader support
  - **UX Enhancement**: Focus failure now shows toast notification guiding user to scroll to fields
  - **Code Quality**: `focusFirstInteractiveElement` returns boolean to indicate success/failure
  - **Documentation**: Added detailed CSS comments explaining prose spacing rationale and values
  - **Style Consistency**: Removed redundant Tailwind prose utility classes to rely on global styles in `index.css`
  - **Code Simplification**: Removed unnecessary `whitespace-pre-line` as ReactMarkdown already handles line breaks
- **Patterns Learned**:
  - Focus management should provide user feedback when automatic focus fails
  - Accessibility labels are essential for interactive UI elements without visible text
  - CSS magic numbers should be documented with context and rationale
  - Avoid duplicating styles between component utilities and global CSS - maintain single source of truth
  - When using helper functions to transform content (like `preserveLineBreaksForMarkdown`), redundant CSS properties can be removed
- **Files Modified**:
  - `frontend/src/pages/WorkNotes/components/ViewWorkNoteDialog.tsx` (accessibility + focus feedback + style cleanup)
  - `frontend/src/styles/index.css` (documentation)

## Known Issues

### AI Gateway Binding in Tests
**Issue**: The `@cloudflare/vitest-pool-workers` environment encounters errors with external AI worker bindings.

**Error**: `wrapped binding module can't be resolved`

**Workarounds**:
1. Mock AI services in tests (recommended for unit testing)
2. Use integration tests in actual Cloudflare environment
3. Update to newer miniflare/workerd versions when AI binding support improves

## Technical Debt
- Consider implementing proper tokenizer library (e.g., tiktoken) instead of character-based approximation for more accurate chunking in production
- Vectorize deleteWorkNoteChunks uses a workaround (query + delete) instead of native prefix deletion - monitor performance with large datasets
- ~~Implement retry mechanism for embedding failures~~ ✅ COMPLETED (TASK-022)
- Future enhancement: Background retry processor using Cloudflare Cron Triggers to process retry queue automatically

## Lessons Learned
- Async embedding in WorkNoteService prevents blocking CRUD operations while ensuring eventual consistency
- Character-based tokenization (~4 chars/token) works well as approximation for Korean and English text
- RRF algorithm (k=60) effectively merges FTS and vector search results
- Korean workplace-specific prompts with JSON-only mode significantly improve AI response quality and reliability
- **Embedding Retry Pattern**: Exponential backoff with dead-letter queue provides robust eventual consistency
  - Prevents thundering herd with increasing delays (2s, 4s, 8s)
  - Dead-letter queue enables manual inspection and retry of permanent failures
  - FK cascade delete ensures retry queue stays clean when work notes are deleted
  - Idempotent operations allow safe retry without side effects

### Session 33: Project Management Feature Planning (2025-11-26)
- **Specification Created**: SPEC-project-1 for comprehensive project management
- **Requirements Gathered**: User input clarified project-work note relationship (1:N), RAG scope (PROJECT filter), file types (PDF, images, Office docs), and required attributes
- **Architecture Decisions**:
  - Projects contain work notes (1:N) - work notes belong to at most one project
  - R2 storage for permanent file attachments (PDF, images, Office documents)
  - PROJECT scope added to RAG with projectId metadata filtering
  - File processing queue for text extraction and embedding from uploaded documents
  - Soft delete for projects and files with archive mechanism
- **Database Design**: 4 new tables (projects, project_participants, project_work_notes, project_files) with proper FKs and indexes
- **Task Breakdown**: 10 tasks (TASK-035 to TASK-044) totaling 37 hours estimated effort
  - Phase 1 (Backend): Schema, repositories, APIs, work note association (14h)
  - Phase 2 (Storage & RAG): R2 file management, RAG extension, file processing pipeline (11h)
  - Phase 3 (Frontend & Testing): UI components, comprehensive tests (12h)
- **Key Features Planned**:
  - Full project CRUD with status tracking, team management, date ranges
  - File upload/download with presigned URLs and 50MB size limit
  - PROJECT scope RAG filtering for project-specific knowledge retrieval
  - Async file text extraction and embedding for PDF, DOCX, TXT files
  - Project statistics dashboard (todo counts, file metrics)
- **Integration Points**: Extends existing work note, RAG, and file processing systems
- **Status**: Specification and task backlog complete, ready to begin implementation with TASK-035

### Session 34: Project Schema Migration (2025-11-26)
- **TASK-035**: Added migration `0014_add_project_management.sql` with projects, participants, work note association, project files, and `project_id` on work_notes plus indexes.
- Created unit test `tests/unit/migration-project-management.test.ts` to assert tables, indexes, and FK links for project schema.
- Synced test fallback schema in `tests/setup.ts` to include project tables/indices and work_notes.project_id.
- Updated `migrations/README.md` and fixed wrangler migration parsing by rephrasing transaction comment in 0011.
- Verified migrations on a clean local D1 DB: `npm run db:migrate:local` now applies through 0014 after resetting `.wrangler/state/v3/d1` data.

### Session 35: Project Frontend UI (2025-11-26)
- **TASK-043**: Implemented project management UI per SPEC-project-1.
- Added project nav/route, list filters (status/leader/date), create dialog (status, priority, dates, leader, dept, tags, participants), detail dialog tabs (info + stats, work note assignment, todo tab using project todos/stats, file tab with drag-and-drop upload/download/delete).
- API client extended for project filters/todos and work note normalization; new project hooks. Vite build passes (`npm run build:frontend`).

### Session 36: Project Repository and Types (2025-11-26)
- **TASK-036 Completed**: Implemented ProjectRepository with full CRUD operations and comprehensive unit tests.
- Created TypeScript types for all project entities (Project, ProjectParticipant, ProjectWorkNote, ProjectFile, ProjectStats, ProjectDetail, ProjectFilters).
- Implemented ProjectRepository methods: findById, findAll (with multiple filter options), getDetail, create, update, delete (soft delete), getParticipants, addParticipant, removeParticipant, getWorkNotes, getFiles, getStatistics.
- Fixed critical snake_case to camelCase mapping issue in getParticipants, getWorkNotes, and getFiles methods.
- Created 32 comprehensive unit tests covering:
  - CRUD operations (create, read, update, delete)
  - Filtering (by status, leader, department, participant, date range)
  - Soft delete functionality
  - Participant management (add, remove, conflict handling)
  - Statistics aggregation (work notes, todos, files)
  - Project detail with all associations
  - Error handling (NotFoundError, ConflictError)
- All tests passing (32/32) in tests/unit/project-repository.test.ts.
- Repository follows existing patterns (PersonRepository, WorkNoteRepository) for consistency.
- **TASK-037 Completed**: Implemented Project CRUD API endpoints with comprehensive integration tests.
- Verified existing routes implementation in src/routes/projects.ts covering all required endpoints:
  - POST /api/projects - Create project with validation and participants
  - GET /api/projects - List with filtering (status, leader, dept, participant, date range)
  - GET /api/projects/:projectId - Get detail with all associations
  - PUT /api/projects/:projectId - Update project fields
  - DELETE /api/projects/:projectId - Soft delete
  - GET /api/projects/:projectId/stats - Project statistics
  - POST/DELETE /api/projects/:projectId/participants - Participant management
  - POST/DELETE/GET /api/projects/:projectId/work-notes - Work note association (enforces 1:N constraint)
- Verified Zod validation schemas in src/schemas/project.ts (createProjectSchema, updateProjectSchema, listProjectsQuerySchema, addParticipantSchema, assignWorkNoteSchema).
- Routes properly mounted in src/index.ts at /api/projects.
- Created 23 comprehensive integration tests in tests/integration/project-routes.test.ts:
  - All CRUD operations tested with success and error cases
  - Filtering tested for all query parameters
  - Participant management with duplicate detection
  - Work note association with project conflict detection (409 when already assigned)
  - Statistics endpoint validation
  - Error handling verified (404 NotFoundError, 409 ConflictError, 400 ValidationError)
- All integration tests passing (23/23).
- **TASK-038 Completed**: Implemented work note to project association with 1:N relationship enforcement.
- Updated Zod validation schemas (src/schemas/work-note.ts):
  - Added optional `projectId` field to createWorkNoteSchema
  - Added nullable `projectId` field to updateWorkNoteSchema (allows null to unassign)
- Updated WorkNoteRepository (src/repositories/work-note-repository.ts):
  - Modified create() to insert project_id column and create project_work_notes association atomically
  - Modified update() to handle projectId changes (remove old association, add new if provided, or remove if null)
  - Updated return objects to include projectId from data instead of hardcoded null
- Verified project association endpoints maintain 1:N constraint (work note can only belong to one project at a time).
- Created 8 comprehensive integration tests in tests/integration/work-note-project-association.test.ts:
  - Create work note with/without projectId
  - Get work note detail includes projectId
  - Assign/reassign/unassign project via PUT
  - 1:N constraint enforcement (409 Conflict when trying to assign to second project)
  - Endpoint consistency verification
- All tests passing (8/8).
- Work notes and projects are now fully integrated with proper association management.
- **TASK-039 Completed**: Implemented R2 file upload and storage for project attachments.
- Added R2_BUCKET binding (worknote-files) to wrangler.toml and Env interface.
- Created ProjectFileService with comprehensive file upload functionality.
- File validation: MIME type checking (PDF, images, Office docs, text), 50MB size limit.
- R2 storage structure: projects/{projectId}/files/{fileId} with custom metadata.
- POST /projects/:projectId/files endpoint accepts multipart/form-data uploads.
- Metadata stored in project_files table: originalName, mimeType, size, uploadedBy, uploadedAt.
- Korean error messages for validation failures.
- **TASK-040 Completed**: Implemented file download, listing, and deletion.
- GET /projects/:projectId/files - Lists all project files with metadata.
- GET /projects/:projectId/files/:fileId/download - Streams file from R2 with proper headers.
- DELETE /projects/:projectId/files/:fileId - Soft delete (removes from R2 and DB).
- Proper MIME type headers for download responses.
- Error handling for file not found (404 NotFoundError).
- **TASK-041 Completed**: Extended RAG service with PROJECT scope filtering.
- Added 'project' to RagScope enum and projectId to RagQueryFilters.
- Updated Zod schema (RagQueryRequestSchema) to accept projectId parameter.
- Extended ChunkMetadata interface with project_id field.
- Updated embedWorkNote() to include projectId in chunk metadata.
- Modified buildVectorFilter() to filter by project_id metadata in Vectorize.
- Updated WorkNoteRepository to select project_id column in all queries.
- PROJECT scope now restricts RAG results to work notes assigned to specified project.
- Existing scopes (GLOBAL, PERSON, DEPT, WORK) remain fully functional.

### Session 37: Task Tracker Reconciliation (2025-11-26)
- **Task Management**: Discovered task tracker was out of sync with actual implementation.
- Git commits showed TASK-039, TASK-040, and TASK-041 were completed but not recorded in `.tasks/done.yaml`.
- Reconciled task tracker:
  - Moved TASK-039, TASK-040, TASK-041 from pending to done.yaml with completion details.
  - Updated backlog.yaml to remove completed tasks.
  - Updated metadata: 14 → 11 total tasks, 47h → 37h estimated effort.
  - Set current.yaml to TASK-042 (File text extraction and embedding pipeline).
- **Pattern Learned**: Task tracker must be updated immediately after completing implementation to maintain operational truth.
- Ready to begin TASK-042: Async file processing queue for text extraction and embedding.
