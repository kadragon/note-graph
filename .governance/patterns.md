# Design Patterns & Architectural Decisions

## Service Layer Pattern

### Repository Pattern
Each entity has a dedicated repository for D1 operations.

```typescript
interface WorkNoteRepository {
  findById(id: string): Promise<WorkNote | null>;
  findAll(filters: WorkNoteFilters): Promise<WorkNote[]>;
  create(data: CreateWorkNoteData): Promise<WorkNote>;
  update(id: string, data: UpdateWorkNoteData): Promise<WorkNote>;
  delete(id: string): Promise<void>;
}
```

**Rationale**: Separates data access from business logic, easier to test and maintain.

## D1 Transaction Pattern

### Batch API for Atomicity
```typescript
const results = await env.DB.batch([
  env.DB.prepare('INSERT INTO work_notes ...').bind(...),
  env.DB.prepare('INSERT INTO work_note_person ...').bind(...),
  env.DB.prepare('INSERT INTO notes_fts ...').bind(...)
]);
```

**Rationale**: D1 doesn't support traditional transactions, batch ensures atomicity.

## FTS Synchronization Pattern

### Trigger-based FTS Updates
```sql
CREATE TRIGGER notes_ai AFTER INSERT ON work_notes BEGIN
  INSERT INTO notes_fts(rowid, title, content_raw)
  VALUES (new.rowid, new.title, new.content_raw);
END;
```

**Rationale**: Automatic synchronization prevents FTS index from going stale.

## Hybrid Search Pattern

### RRF (Reciprocal Rank Fusion)
```typescript
function calculateRRF(lexicalResults: SearchResult[], semanticResults: SearchResult[], k = 60): SearchResult[] {
  const scoreMap = new Map<string, number>();

  lexicalResults.forEach((item, index) => {
    const score = 1 / (k + index + 1);
    scoreMap.set(item.id, (scoreMap.get(item.id) || 0) + score);
  });

  semanticResults.forEach((item, index) => {
    const score = 1 / (k + index + 1);
    scoreMap.set(item.id, (scoreMap.get(item.id) || 0) + score);
  });

  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

**Rationale**: Combines lexical precision with semantic recall, proven effective in IR research.

## RAG Chunking Pattern

### Sliding Window with Overlap
```typescript
interface ChunkConfig {
  size: number;      // 512 tokens
  overlap: number;   // 0.2 (20%)
}

function chunkText(text: string, config: ChunkConfig): Chunk[] {
  const tokens = tokenize(text);
  const chunks: Chunk[] = [];
  const step = Math.floor(config.size * (1 - config.overlap));

  for (let i = 0; i < tokens.length; i += step) {
    const chunkTokens = tokens.slice(i, i + config.size);
    chunks.push({
      text: detokenize(chunkTokens),
      startOffset: i,
      endOffset: i + chunkTokens.length
    });
  }

  return chunks;
}
```

**Rationale**: Overlap prevents information loss at chunk boundaries.

## Queue-based Async Processing

### PDF Processing Pipeline
```typescript
// Producer (Worker)
await env.PDF_QUEUE.send({
  jobId: 'job-123',
  r2Key: 'pdfs/temp/file.pdf',
  metadata: { category, personIds }
});

// Consumer (Queue Worker)
export default {
  async queue(batch: MessageBatch<PdfJob>, env: Env) {
    for (const message of batch.messages) {
      await processPdfJob(message.body, env);
      message.ack();
    }
  }
}
```

**Rationale**: Avoids Worker CPU time limits, enables retry logic.

## Optimistic UI Pattern

### Immediate Feedback with Background Sync
```typescript
// Client-side
async function createTodo(data: CreateTodoData) {
  // 1. Optimistic update
  const optimisticTodo = { ...data, id: generateTempId(), status: 'pending' };
  addToLocalState(optimisticTodo);

  try {
    // 2. Background API call
    const result = await api.createTodo(data);

    // 3. Reconcile
    replaceInLocalState(optimisticTodo.id, result);
  } catch (error) {
    // 4. Rollback on error
    removeFromLocalState(optimisticTodo.id);
    showError(error);
  }
}
```

**Rationale**: Improves perceived performance, critical for serverless latency.

## Version Management Pattern

### Automatic Pruning
```typescript
async function saveVersion(workId: string, content: WorkNoteContent) {
  const MAX_VERSIONS = 5;

  await env.DB.batch([
    // Insert new version
    env.DB.prepare(
      'INSERT INTO work_note_versions (work_id, version_no, ...) VALUES (?, ?, ...)'
    ).bind(workId, nextVersionNo, ...),

    // Delete oldest if > MAX_VERSIONS
    env.DB.prepare(`
      DELETE FROM work_note_versions
      WHERE id IN (
        SELECT id FROM work_note_versions
        WHERE work_id = ?
        ORDER BY version_no DESC
        LIMIT -1 OFFSET ?
      )
    `).bind(workId, MAX_VERSIONS)
  ]);
}
```

**Rationale**: Bounded storage growth, automatic cleanup.

## Todo Recurrence Pattern

### Factory Method for Recurrence Types
```typescript
interface RecurrenceStrategy {
  calculateNextDueDate(current: Todo, completedAt: Date): Date;
}

class DueDateRecurrence implements RecurrenceStrategy {
  calculateNextDueDate(current: Todo): Date {
    return addInterval(current.dueDate, current.repeatRule);
  }
}

class CompletionDateRecurrence implements RecurrenceStrategy {
  calculateNextDueDate(current: Todo, completedAt: Date): Date {
    return addInterval(completedAt, current.repeatRule);
  }
}

function getRecurrenceStrategy(type: RecurrenceType): RecurrenceStrategy {
  switch (type) {
    case 'DUE_DATE': return new DueDateRecurrence();
    case 'COMPLETION_DATE': return new CompletionDateRecurrence();
  }
}
```

**Rationale**: Strategy pattern makes recurrence logic extensible and testable.

## Metadata Design for Vectorize

### Compact String Encoding
```typescript
// WRONG: Exceeds 64 bytes
metadata: {
  personIds: personIds.join(','), // Could be very long
}

// RIGHT: Reference-based
metadata: {
  workId: 'WORK-001',           // 8 bytes
  scope: 'PERSON',              // 6 bytes
  entityId: 'person-123',       // 10 bytes
  createdAtBucket: '2025-11',   // 7 bytes
}

// Then join with D1 for full data
```

**Rationale**: Vectorize has strict metadata size limits, use as filter keys only.

## Error Propagation Pattern

### Domain Errors
```typescript
class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

class ValidationError extends DomainError {
  constructor(message: string, public details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
```

**Rationale**: Type-safe error handling, automatic HTTP status mapping.
