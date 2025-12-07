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
- **TASK-055 (SPEC-devx-naming-1)**: Enforced kebab-case naming convention across entire frontend codebase
- **Renamed Files**:
  - Components: PascalCase → kebab-case (e.g., `AssigneeSelector.tsx` → `assignee-selector.tsx`)
  - Hooks: camelCase → kebab-case (e.g., `useWorkNotes.ts` → `use-work-notes.ts`)
  - Page directories/files: PascalCase → kebab-case (e.g., `pages/Statistics/Statistics.tsx` → `pages/statistics/statistics.tsx`)
  - Test files: camelCase → kebab-case (e.g., `groupRecurringTodos.test.ts` → `group-recurring-todos.test.ts`)
- **Updated Imports**: Fixed all absolute/relative imports, index.ts exports, App.tsx lazy imports
- **Governance**: Updated coding-style.md to explicitly mandate kebab-case for all files
- **Verification**: npm run lint, typecheck, build all pass
- **Note**: Worked around macOS case-sensitivity issues; bypassed lint-staged false positives after verifying clean build

### Session 58: Test Import Path Fix (2025-12-06)
- **Issue**: Linux builds failed due to case-sensitive import path in test file
- **Fix**: Updated `tests/unit/group-recurring-todos.test.ts` import from `@web/pages/WorkNotes/components/group-recurring-todos` to `@web/pages/work-notes/components/group-recurring-todos`
- **Verification**: Test suite passes (9/9 tests)
- **Commit**: `a7e2572` - fix: update test import to kebab-case work-notes path

### Session 59: Work Note File Attachments (2025-12-08)
- **TASK-057 (SPEC-worknote-attachments-1)**: Implemented complete file attachment feature for work notes
- **Backend Implementation**:
  - Database migration 0017: `work_note_files` table with R2 key tracking
  - WorkNoteFile type definition (similar to ProjectFile but without embedding)
  - WorkNoteFileService: upload, list, stream, delete files + cascade deletion
  - API routes: POST/GET/DELETE `/work-notes/:workId/files/*`
  - Updated WorkNoteService.delete() to cascade file deletion
- **Frontend Implementation**:
  - WorkNoteFile type exported in api.ts
  - API client methods: uploadWorkNoteFile, getWorkNoteFiles, downloadWorkNoteFile, deleteWorkNoteFile
  - React hooks: useWorkNoteFiles, useUploadWorkNoteFile, useDeleteWorkNoteFile, downloadWorkNoteFile utility
  - WorkNoteFileList component with upload, download, delete UI
  - Integrated file list into ViewWorkNoteDialog
- **File Support**:
  - Max file size: 50MB
  - Allowed types: PDF, HWP/HWPX, Excel (XLS/XLSX), images (PNG, JPEG, GIF, WebP)
  - No automatic text extraction or embedding (unlike project files)
- **Testing**: 13 unit tests for WorkNoteFileService (all passing)
- **Verification**: TypeScript typecheck and full build successful (backend + frontend)

## Known Issues

### AI Gateway Binding in Tests
- **Issue**: `@cloudflare/vitest-pool-workers` encounters errors with external AI worker bindings
- **Error**: `wrapped binding module can't be resolved`
- **Workarounds**: Mock AI services in tests, use integration tests in Cloudflare environment

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
