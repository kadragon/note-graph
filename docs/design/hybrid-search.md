# Hybrid Search

## Problem

Work notes contain domain-specific Korean terminology that behaves poorly under
pure semantic search (the embedding model may conflate synonyms or miss exact
product names). Pure keyword search misses semantically similar content when the
user's phrasing does not match the document vocabulary. Combining both approaches
improves recall for both exact and fuzzy query patterns.

The `/search/work-notes` and `/search/unified` endpoints exist to power the
application's search UI. The UI expects ranked work notes with a `source`
attribution tag (`LEXICAL`, `SEMANTIC`, or `HYBRID`) so users can understand why a
result appeared.

## Constraints

- **Two distinct search backends must run in parallel**, and either one failing
  must not abort the overall search. Each backend has its own `try/catch` that
  returns `[]` on error (`hybrid-search-service.ts:62-73`, `78-123`).
- **Person and department filters cannot be pushed into Vectorize metadata** for
  the same reason as RAG: person IDs are stored as a CSV string. These filters are
  applied by joining through `work_note_person` and `persons` tables after
  the vector lookup (`hybrid-search-service.ts:254-267`).
- **Category filter can be pushed into Vectorize** because it is stored as a
  discrete string field. All other filters (person, department, date range) are
  applied at the database layer.
- **The `/search/work-notes` endpoint does not use `HybridSearchService`.**
  It uses `KeywordSearchService` directly, which implements a richer
  lexical-only scoring model with title boosting and recency decay. Hybrid search
  is available as a service class but is not currently wired to a route.
  `search.ts:23-46` confirms `KeywordSearchService` is the live implementation.
- **SQL variable limit.** Large ID lists are chunked in batches defined by
  `SQL_VAR_LIMIT` when querying the database for vector-matched work notes
  (`hybrid-search-service.ts:240`).

## Decision

### Architecture

Three service classes cooperate:

```
HybridSearchService
├── FtsSearchService        (PostgreSQL tsvector, lexical)
└── VectorizeService        (Cloudflare Vectorize, semantic)
    └── OpenAIEmbeddingService
```

### Reciprocal Rank Fusion (RRF)

RRF merges two independently ranked lists without requiring score normalisation.
The formula applied at `hybrid-search-service.ts:148,164` is:

```
rrfScore(doc) = sum over each list L of: 1 / (k + rank_L(doc))
```

The constant `k = 60` is the default, matching the value cited in the original
Cormack et al. (2009) paper. A document appearing in both lists accumulates scores
from both, naturally boosting cross-list overlap. The merged list is sorted
descending by combined RRF score. Source attribution is set to `HYBRID` when both
lists contain the document, otherwise `LEXICAL` or `SEMANTIC`.

Both FTS and vector searches fetch `limit * 2` candidates before merging, so the
post-merge slice to `limit` has enough material to work with.

### FTS Leg (FtsSearchService)

- Uses PostgreSQL `tsvector` with the `simple` dictionary (no stemming, works for
  Korean tokens).
- CTE `fts_matches` applies the FTS filter first, then joins to `work_notes` to
  apply metadata filters. This avoids a full table scan on `work_notes` before
  winnowing by FTS (`postgres-fts-dialect.ts:1-7`).
- Ranking uses `ts_rank` (term frequency + positional weight). The rank is negated
  in the CTE (`-ts_rank(...)`) so that `ORDER BY rank ASC` returns the best matches
  first (`postgres-fts-dialect.ts:3`).
- Score is normalised to [0, 1] with the formula `max(0, 1 + fts_rank / 10)`
  (`fts-search-service.ts:108`). FTS rank values are typically in `[-10, 0]`.
- Token operator: `OR` (any token matches).

### Vector Leg (HybridSearchService.executeVectorSearch)

- Query text is embedded via `OpenAIEmbeddingService.embed()`.
- `VectorizeService.query()` is called with `topK = limit * 2` and an optional
  category filter.
- Matched IDs are used to batch-fetch work notes from the database. Person and
  department filters are applied here via SQL JOIN (`hybrid-search-service.ts:
  253-267`), not in the Vectorize query.

### KeywordSearchService (live /search endpoint)

`KeywordSearchService` is the lexical-only service used by the live search routes.
It is more sophisticated than `FtsSearchService`:

1. **AND query first, OR fallback.** An AND-operator tsvector query is tried first
   (all tokens must match). If fewer results than `limit` are returned, an OR query
   is run and merged (`keyword-search-service.ts:47-73`).
2. **BM25 scoring.** The CTE uses `ts_rank_cd` with normalization flag `1`
   (divides by 1 + log(document length)) as a BM25 approximation
   (`postgres-fts-dialect.ts:9-19`).
3. **Candidate over-fetch.** `candidateLimit = min(max(limit * 6, 40), 200)` to
   give the re-ranking step enough material.
4. **Re-ranking formula** (`keyword-search-service.ts:92-131`):
   - `textScore` is a rank-based score (position in BM25 order, normalised to
     [0, 1] using `1 - index / (N + 2)`).
   - `titleBoost` adds up to +0.12 for exact title match, +0.08 for phrase
     inclusion, +0.10 proportional to token coverage in the title.
   - `recencyBoost` adds up to +0.05 with exponential decay over a 180-day
     half-life.
   - Final: `clamp(0.75 * textScore + titleBoost + recencyBoost, 0, 1)`.
5. **Tie-breaking** by `createdAt` descending.

### Unified Search (`POST /search/unified`)

Runs four searches in parallel with `Promise.all`:

- Work notes via `KeywordSearchService`
- Persons via `personRepository.findAll(query)`
- Departments via `departmentRepository.findAll(query)`
- Meeting minutes via `MeetingMinuteReferenceService.search()`

Results are merged into a `UnifiedSearchResponse` without cross-domain ranking.

### Token Extraction

`buildWorkNoteTsQuery()` in `work-notes-fts.ts` tokenises the raw query using the
regex `FTS_TERM_PATTERN = /[\p{L}\p{N}]+/gu` (`fts-constants.ts:1`). This matches
any Unicode letter or digit sequence, handling Korean, Latin, and numeric tokens
uniformly. Tokens are single-quoted and joined with the chosen PostgreSQL operator.

## Rejected Alternatives

- **Applying person/department filters inside Vectorize.** Not feasible for
  person filtering (CSV metadata, no partial match). Applied via SQL JOIN instead.

- **Single-pass BM25 without AND/OR fallback.** A strict AND query can return zero
  results for multi-token queries when not all tokens appear in a document. The
  AND-then-OR fallback in `KeywordSearchService` preserves precision when AND has
  enough hits and falls back to recall-oriented OR automatically.

- **Score-based fusion (weighted sum of normalised scores).** Score normalisation
  across different systems (FTS rank vs. cosine similarity) requires calibration.
  RRF is rank-based and requires no normalisation, making it robust to scale
  differences between the two backends.

- **Re-using FtsSearchService for the /search endpoint.** `FtsSearchService` uses
  a simpler `ts_rank` + linear normalisation. `KeywordSearchService` was introduced
  to layer title boosting and recency signals on top of BM25, producing a ranking
  that surfaces recently updated and title-matching notes more prominently.
