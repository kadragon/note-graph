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

## Known Issues
_None yet_

## Technical Debt
_None yet_

## Lessons Learned
_To be updated as development progresses_
