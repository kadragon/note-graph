# RAG (Retrieval-Augmented Generation)

## Problem

Work notes accumulate over time and users need to ask natural-language questions
across that corpus rather than formulating precise keyword queries. A plain search
returns a ranked list; RAG returns a synthesized prose answer backed by cited
source snippets, which is more useful for questions like "What did we do about the
network upgrade last quarter?"

## Constraints

- **Cloudflare Workers runtime.** No long-running processes; responses must complete
  within the Workers CPU time limit. Long LLM calls are kept alive with SSE
  heartbeats.
- **Vectorize metadata limits.** String fields stored in Cloudflare Vectorize must
  be < 64 bytes. Person ID lists and department names are byte-truncated before
  storage (`vectorize-service.ts:84-125`).
- **Vectorize cannot do partial-string matching.** Filtering by `person_id` through
  Vectorize metadata is not possible because person IDs are stored as a
  comma-separated string. The work-around is to over-fetch (`topK * 3`) and
  post-filter in application code (`rag-service.ts:72`).
- **Similarity threshold.** Only chunks with cosine similarity >= 0.5 are included
  in context (`rag-service.ts:30`). Chunks below the threshold are discarded to
  avoid injecting irrelevant context into the prompt.
- **Answer length.** GPT responses are capped at 1 000 completion tokens
  (`rag-service.ts:39`) to keep latency and cost bounded.
- **Prompt is user-configurable.** The query prompt template is stored in the
  `app_settings` table under key `prompt.rag.query` and falls back to
  `DEFAULT_RAG_QUERY_PROMPT` (`setting-defaults.ts:46`). The template uses two
  named placeholders: `{{CONTEXT_TEXT}}` and `{{QUERY}}`.
- **N+1 query elimination.** Context assembly requires mapping chunk IDs back to
  work note rows. All work notes are fetched in a single batch query rather than
  one query per chunk (`rag-service.ts:205-224`).

## Decision

### Entry Point

`POST /rag/query` is handled by `apps/worker/src/routes/rag.ts:16`. The route
validates the request body with `RagQueryRequestSchema`, enforces scope-specific
required fields (e.g. `personId` for `person` scope), and then delegates to
`RagService.query()`. The response is streamed as SSE using
`createBufferedSSEResponse`, which sends a `: heartbeat` comment every 5 s while
the LLM call is in flight and delivers the final payload as a single `data:` event
(`buffered-sse.ts:28-73`).

### Scopes

Four query scopes narrow the vector search:

| Scope | Vector filter applied | Post-filter in code |
|---|---|---|
| `global` | none | none |
| `work` | `work_id = <workId>` | none |
| `department` | `dept_name = <deptName>` | none |
| `person` | none (Vectorize limitation) | chunks whose `person_ids` CSV contains `personId` |

### Execution Flow

1. **Embed the query.** `OpenAIEmbeddingService.embed(query)` calls the OpenAI
   embeddings endpoint through Cloudflare AI Gateway and returns a 1536-dimension
   float vector (`openai-embedding-service.ts:31-37`).

2. **Vector search.** `VectorizeService.query(embedding, { topK, filter,
   returnMetadata: true })` is called. For `person` scope, `topK` is multiplied by
   3 to compensate for the post-filter drop-off (`rag-service.ts:72`).

3. **Threshold filter.** Matches with `score < 0.5` are dropped.

4. **Context assembly** (`buildContextSnippets`):
   - For `person` scope, results whose `person_ids` metadata field does not contain
     `filters.personId` are removed.
   - Unique work IDs are extracted from chunk IDs via
     `ChunkingService.parseChunkId()` which splits on `#chunk`
     (`chunking-service.ts:301-307`).
   - All work notes are fetched in one SQL query.
   - For each result, `extractSnippet()` reconstructs the chunk text by calling
     `ChunkingService.getChunkText(fullText, chunkIndex)`, which recomputes the
     sliding window offset (`chunking-service.ts:273-282`). Display length is
     capped at 500 characters.
   - Assembly stops once `topK` snippets have been collected.

5. **Prompt construction.** `constructPrompt()` formats each snippet as a
   numbered Korean-language context block, then substitutes `{{CONTEXT_TEXT}}` and
   `{{QUERY}}` into the prompt template.

6. **LLM call.** `callGPT()` calls `callOpenAIChat()` with the assembled prompt as
   a `user` message. The model is resolved from `SettingService` or falls back to
   `env.OPENAI_MODEL_CHAT`.

7. **Response.** `{ answer: string, contexts: RagContextSnippet[] }` is serialised
   and sent as the final SSE `data:` event.

### Key Data Structures

```typescript
// rag-service.ts (from @shared/types/search)
interface RagContextSnippet {
  workId: string;
  title: string;
  snippet: string;  // up to 500 chars of the matching chunk
  score: number;    // cosine similarity from Vectorize
}

interface RagQueryResponse {
  answer: string;
  contexts: RagContextSnippet[];
}
```

## Rejected Alternatives

- **Streaming token-by-token SSE from the LLM.** OpenAI streaming would lower
  time-to-first-token but complicates the response contract (clients must handle
  partial JSON). The current design buffers the complete answer and sends it in one
  event, which is simpler. The heartbeat mechanism (`buffered-sse.ts`) prevents
  connection timeouts during the wait.

- **Filtering `person` scope at the Vectorize level.** Vectorize metadata filters
  require exact string equality. Storing a comma-separated list of person IDs
  makes exact-match impossible for multi-person notes. The chosen work-around
  (over-fetch + application-side filter) is noted explicitly in the code
  (`rag-service.ts:127-129`).

- **Per-chunk DB lookup.** Fetching work note details one chunk at a time would
  cause N+1 queries. Batch fetching all unique work IDs in one `WHERE work_id IN
  (...)` query is the explicit design choice (`rag-service.ts:205-224`).

- **Using the same embedding model as indexing at query time, hardcoded.** The
  embedding model is resolved through `SettingService` at runtime so operators can
  switch models without redeploying.
