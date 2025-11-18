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

## Known Issues
_None yet_

## Technical Debt
_None yet_

## Lessons Learned
_To be updated as development progresses_
