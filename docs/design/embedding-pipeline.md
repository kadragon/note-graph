# Embedding Pipeline

## Problem

Work notes and meeting minutes must be indexed as dense vector embeddings in
Cloudflare Vectorize so that semantic search and RAG can retrieve relevant
passages. The indexing must handle:

- Initial bulk ingestion of all existing notes.
- Incremental updates when a single note is created or edited.
- Periodic catch-up for notes whose embedding failed or was never run.
- Correct cleanup of stale vector chunks when a note's content changes (chunk
  count may decrease).
- Meeting minutes as a second content type with its own chunking layout.

## Constraints

- **Cloudflare Workers CPU limits.** Bulk reindex must not exhaust CPU time in a
  single invocation. Processing is batched; `reindexAll` uses keyset pagination
  (`embedding-processor.ts:126-149`) and `embedPending` processes up to
  `batchSize` notes per cron invocation (default 10).
- **OpenAI embedding API batch limit.** The API accepts up to 2 048 inputs per
  call. The service uses a conservative internal limit of 100 chunks per batch
  (`embedding-processor.ts:39`).
- **Vectorize metadata string limit: 64 bytes.** All metadata fields are
  byte-truncated before storage. Person IDs are progressively trimmed
  (whole IDs dropped, not mid-ID) to stay within 60 bytes
  (`vectorize-service.ts:106-125`). Department names and category strings are
  truncated to 60 bytes with UTF-8 boundary awareness
  (`vectorize-service.ts:84-103`).
- **Vectorize delete batch limit.** Stale chunk IDs are deleted in batches of 100
  (`embedding-processor.ts:38 VECTOR_DELETE_BATCH_SIZE`).
- **Concurrent modification safety.** The `embedPending` path records the expected
  `updated_at` at chunk-preparation time and uses
  `updateEmbeddedAtIfUpdatedAtMatches` to mark completion only if the note has not
  changed since preparation (`embedding-processor.ts:566-583`). If the timestamp
  has changed, the note is marked as a `STALE_VERSION` failure and will be picked
  up by the next pending run.
- **Character-based token approximation.** Exact tokenisation of Korean text for
  OpenAI models would require a tokenizer library not available in the Workers
  runtime. The chunking service uses a fixed ratio of 4 characters per token
  (`chunking-service.ts:34`), which is a reasonable approximation for a mix of
  Korean and Latin text.

## Decision

### Components

```
EmbeddingProcessor          (orchestration, batching, stale-chunk cleanup)
├── ChunkingService         (text splitting, ID generation)
├── OpenAIEmbeddingService  (OpenAI embeddings API via Cloudflare AI Gateway)
└── VectorizeService        (Vectorize upsert / delete / query)
```

### Chunking

`ChunkingService` implements a sliding window strategy with configurable overlap.
Default configuration (`DEFAULT_CHUNK_CONFIG`): chunk size 512 tokens, overlap
ratio 0.2 (`chunking-service.ts:17-20`).

Character budget:
- `chunkSizeChars = 512 * 4 = 2 048 characters`
- `stepChars = floor(2048 * 0.8) = 1 638 characters`
- Minimum chunk size: `2 048 * 0.1 = 204.8 characters`; trailing slices smaller
  than this are dropped rather than producing a very short final chunk.

For a work note, the full text composed for chunking is:

```
{title}\n\n{contentRaw}[\n\n## 할일\n{todo lines}]
```

Todo items are appended as bullet lines (`- {title}: {description}`) so they are
retrievable by semantic search without a separate embedding
(`embedding-processor.ts:165-167`).

For a meeting minute the full text is:

```
{topic}\n\n{detailsRaw}[\n\n키워드: {keywords}]
```

Chunk IDs are deterministic strings of the form `{workId}#chunk{N}`
(`chunking-service.ts:291-293`). This is critical for stale-chunk cleanup: given
the new chunk count, the processor can derive and delete the exact IDs for all
higher-numbered chunks without querying Vectorize.

Chunk metadata stored in Vectorize:

| Field | Source | Notes |
|---|---|---|
| `work_id` | work note / meeting ID | |
| `scope` | `'WORK'` / `'MEETING'` / `'FILE'` | |
| `chunk_index` | integer, 0-based | |
| `person_ids` | comma-separated person IDs | byte-limited to 60 |
| `dept_name` | first person's current dept | byte-limited to 60 |
| `category` | work note category | byte-limited to 60 |
| `created_at_bucket` | `YYYY-MM-DD` | date of the note |

### Embedding

`OpenAIEmbeddingService` calls `POST /embeddings` through Cloudflare AI Gateway
(`openai-embedding-service.ts:63-86`). The gateway URL is constructed from
`env.CLOUDFLARE_ACCOUNT_ID` and `env.AI_GATEWAY_ID`. The embedding model is
resolved from `SettingService` (key `config.openai_model_embedding`) with
`env.OPENAI_MODEL_EMBEDDING` as fallback. Responses return 1 536-dimension float
vectors.

Rate limit errors (HTTP 429) are surfaced as a structured `AI_RATE_LIMIT` error
string for caller classification (`openai-embedding-service.ts:79`).

### Vectorize Upsert

`upsertChunks()` (`embedding-processor.ts:621-644`) is the central write path:

1. Extract `texts` from the chunk array.
2. Call `embeddingService.embedBatch(texts)` — one API call for up to 100 texts.
3. Zip embeddings with chunk IDs and metadata.
4. Encode metadata through `VectorizeService.encodeMetadata()` (byte-truncation).
5. Call `vectorize.upsert(vectors)`.

This method is `public` so `WorkNoteService` can invoke it directly for
single-note updates triggered by the REST API without going through the full
`reindexOne` path.

### Stale Chunk Cleanup

When a note is re-embedded after an edit, the new chunk count may be smaller than
the previous count. `deleteStaleChunks(workId, newChunkCount, previousChunkCount)`
deletes vector IDs in the range `[newChunkCount, previousChunkCount)` using
deterministic ID generation (`embedding-processor.ts:650-663`).

`getMaxKnownChunkCount()` consults all stored versions of the work note to find
the historical maximum chunk count, ensuring no stale vectors are left behind even
after multiple edits (`embedding-processor.ts:688-712`).

### Bulk Reindex (`reindexAll`)

- Iterates all work notes in `created_at ASC` order using keyset pagination (cursor
  on `created_at`), avoiding `OFFSET` degradation on large tables.
- For each batch, fetches details and todos in two parallel batch queries
  (`Promise.all`) to eliminate N+1 patterns.
- Processes each note sequentially within the batch to bound memory usage.
- On failure, records the error and continues. Failed notes have `NULL embedded_at`
  and are retried by `embedPending`.

### Incremental Embedding (`embedPending`)

- Fetches notes with `embedded_at IS NULL` or `embedded_at < updated_at`.
- Collects chunks from multiple notes into a shared `allChunks` array.
- When `allChunks.length >= 100`, flushes the batch: embeds all chunks in one API
  call, then runs per-note finalization in parallel (`Promise.allSettled`).
- Finalization: delete stale chunks, then conditionally update `embedded_at` using
  the optimistic-lock check.
- Failed IDs are added to a `failedIds` set to prevent infinite retry within the
  same invocation.

### Meeting Minutes

Meeting minutes follow the same pipeline as work notes. Key differences:

- `chunkMeetingMinute()` appends keywords instead of todos.
- `scope` metadata is set to `'MEETING'`.
- Attendee person IDs are batch-fetched via `findAttendeePersonIdsByMeetingIds()`
  before the loop (`embedding-processor.ts:800-801`) to avoid N+1 queries.
- Stale chunk estimation for meetings uses `estimateChunkCount()` directly (no
  version history available), so cleanup is best-effort.

### Failure Classification

```typescript
const EMBEDDING_FAILURE_REASON = {
  UNKNOWN:        'UNKNOWN',
  NOT_FOUND:      'NOT_FOUND',        // work note deleted between fetch and finalize
  STALE_VERSION:  'STALE_VERSION',    // note updated during embedding
  PREPARE_FAILED: 'PREPARE_FAILED',   // error during chunk preparation
  UPSERT_FAILED:  'UPSERT_FAILED',   // Vectorize write failed
}
```

`EmbeddingSkipError` is the internal exception type used to carry a reason code
through the stack without losing the classification.

## Rejected Alternatives

- **OFFSET-based pagination for bulk reindex.** OFFSET scans become expensive as
  the table grows. Keyset pagination on `created_at` is O(log n) after the index
  seek and was chosen explicitly (`embedding-processor.ts:122`).

- **Exact tokenisation (tiktoken).** A proper tokenizer would give accurate
  chunk boundaries for the OpenAI token budget but is not available in the Workers
  runtime. The 4-chars-per-token heuristic is documented in the code
  (`chunking-service.ts:29`) and produces chunks well within the model's 8 192
  token input limit.

- **Storing chunk text in the database.** Chunk text is not persisted; it is
  reconstructed on demand by recomputing the sliding window offset from the stored
  `chunk_index`. This avoids a separate chunks table and keeps the schema simple.
  The trade-off is that snippet extraction at RAG query time requires re-running
  the chunking arithmetic.

- **Deleting all old vectors before re-upserting.** A delete-then-insert approach
  creates a window during which the note has no vectors. The upsert + deterministic
  range-delete strategy means old vectors are replaced atomically and only excess
  chunks (those beyond the new count) are removed.

- **Separate embedding worker per content type.** Work notes and meeting minutes
  share `EmbeddingProcessor` through method dispatch (`embedPending`,
  `embedPendingMeetings`). Splitting into separate classes would duplicate the
  batch orchestration logic (`processChunkBatch`), which is the most complex part.
