# Quality Grades

Per-domain quality assessment. Updated as gaps are found or resolved.

## Grading Scale

- **A**: Well-tested, documented patterns, no known gaps.
- **B**: Tested, minor gaps or inconsistencies.
- **C**: Partially tested, significant gaps.
- **D**: Untested or unreliable.

## Current Grades

| Domain | Grade | Notes |
|---|---|---|
| **Repositories (DB)** | B | 19 test files, PGlite integration. Todo repo thoroughly covered (CRUD, filter, recurrence, query). |
| **Services (pure)** | B | 20+ test files. AI/search/RAG services well-covered. Some services lack edge case tests. |
| **Schemas (Zod)** | B | Dedicated schema test file. Covers validation paths. |
| **Auth middleware** | B | JWT verification tested. Dev fallback path tested. |
| **Frontend hooks** | B | 40+ hooks tested with React Testing Library. |
| **Frontend components** | C | UI/dialog/form tests exist but coverage uneven. |
| **Integration (route-level)** | C | `tests/integration/` exists but sparse. |
| **Embedding pipeline** | C | Batch tests exist. End-to-end flow (CRUD → chunk → embed → vectorize) not fully integration-tested. |
| **Error handling** | B | Custom error types, middleware catches. Validation middleware tested. |
| **Migration safety** | C | Known incident: repair vs actual DDL. AGENTS.md documents rule but no automated guard. |

## Coverage Thresholds (vitest)

- Statements: 71%
- Branches: 58%
- Functions: 58%
- Lines: 71%

## Known Gaps

1. **No structural/architectural tests** — dependency direction violations are not mechanically enforced.
2. **Integration tests sparse** — route-level end-to-end coverage is thin.
3. **Frontend component test coverage uneven** — pages mostly untested at component level.
4. **Migration verification** — no automated check that remote DB schema matches migration history.
5. **Cron job testing** — `scheduled()` handler not directly tested.
