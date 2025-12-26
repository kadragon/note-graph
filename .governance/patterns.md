# Design Patterns & Architectural Decisions

## Service Layer Pattern

### Repository Pattern
Each entity has a dedicated repository for D1 operations with standard CRUD interface.
**Rationale**: Separates data access from business logic, easier to test and maintain.

## D1 Transaction Pattern

### Batch API for Atomicity
Use `env.DB.batch([...])` for multiple related operations that must succeed or fail together.
**Rationale**: D1 doesn't support traditional transactions, batch ensures atomicity.

## FTS Synchronization Pattern

### Trigger-based FTS Updates
Database triggers (AFTER INSERT/UPDATE/DELETE) automatically sync FTS index with source table.
**Rationale**: Automatic synchronization prevents FTS index from going stale.

## Hybrid Search Pattern

### RRF (Reciprocal Rank Fusion)
Combine lexical (FTS5) and semantic (Vectorize) results using RRF formula: `score = 1 / (k + rank)` where k=60.
Aggregate scores for items appearing in both result sets.
**Rationale**: Combines lexical precision with semantic recall, proven effective in IR research.

## RAG Chunking Pattern

### Sliding Window with Overlap
Chunk text into 512-token segments with 20% overlap using sliding window (step = size × 0.8).
**Rationale**: Overlap prevents information loss at chunk boundaries.

## Queue-based Async Processing

### PDF Processing Pipeline
Producer sends jobs to Cloudflare Queue; consumer processes batches with `message.ack()` on success.
**Rationale**: Avoids Worker CPU time limits, enables retry logic.

## Optimistic UI Pattern

### Immediate Feedback with Background Sync
Add temp item to local state immediately → make API call → reconcile on success or rollback on error.
**Rationale**: Improves perceived performance, critical for serverless latency.

## Version Management Pattern

### Automatic Pruning
Batch insert new version + delete oldest beyond MAX_VERSIONS (5) limit using `LIMIT -1 OFFSET 5`.
**Rationale**: Bounded storage growth, automatic cleanup.

## Todo Recurrence Pattern

### Factory Method for Recurrence Types
Strategy pattern with `DueDateRecurrence` (next due = prev due + interval) and `CompletionDateRecurrence` (next due = completion + interval).
**Rationale**: Strategy pattern makes recurrence logic extensible and testable.

## Metadata Design for Vectorize

### Compact String Encoding
Store only filter keys (workId, scope, entityId, createdAtBucket) within 64-byte limit; join with D1 for full data.
**Rationale**: Vectorize has strict metadata size limits, use as filter keys only.

## Error Propagation Pattern

### Domain Errors
Base `DomainError` class with code and statusCode; subclasses: `NotFoundError` (404), `ValidationError` (400), etc.
**Rationale**: Type-safe error handling, automatic HTTP status mapping.

## Centralized Error Handler Middleware Pattern

### Global Error Middleware
Apply `errorHandler` middleware to catch all route errors; maps `DomainError` to HTTP status, logs unexpected errors.
Eliminates try-catch boilerplate in routes (~400 LOC saved).
**Rationale**: Consistent error responses, structured logging, cleaner route handlers.

## Resource Access Utility Pattern

### Single Source of Truth for Resource Access
Centralized `getR2Bucket(env)` utility handles production and test environment fallback (~8 duplicates removed).
**Rationale**: Single source of truth for resource initialization, consistent error handling.
