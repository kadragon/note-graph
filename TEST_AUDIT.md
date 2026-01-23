# Test Suite Audit Report

## Summary
- **Total Unit Tests**: ~36 files in `tests/unit/`, ~26 files in `apps/web/src/**/*.test.ts`
- **Total Lines**: ~12,000 in backend, ~5,900 in frontend
- **Key Finding**: Significant redundancy and triviality that can be consolidated

---

## 2026-01-22 Inventory & Tagging (Phase A)

### Inventory Snapshot
- Scope: repo test files only; `node_modules/`, `dist/`, `coverage/` excluded.
- Total: 104 test files, 23,920 total lines (raw line count).
- By layer:
  - backend/unit: 42 files, 12,050 lines
  - backend/integration: 12 files, 2,787 lines
  - backend/other: 1 file, 614 lines
  - web/hooks: 22 files, 4,392 lines
  - web/pages: 16 files, 2,071 lines
  - web/components: 3 files, 509 lines
  - web/lib: 6 files, 1,376 lines
  - web/test-setup: 2 files, 121 lines

### Domain Tags (filename-based, heuristic)
Note: Domain tagging is based on file naming patterns; confirm during validity review.

- work-notes (25)
  - `apps/web/src/hooks/__tests__/use-download-work-note.test.ts`
  - `apps/web/src/hooks/__tests__/use-pdf.test.ts`
  - `apps/web/src/hooks/__tests__/use-work-notes.errors.test.ts`
  - `apps/web/src/hooks/__tests__/use-work-notes.mutations.test.ts`
  - `apps/web/src/hooks/__tests__/use-work-notes.query.test.ts`
  - `apps/web/src/lib/pdf/generate-work-note-pdf.test.ts`
  - `apps/web/src/lib/pdf/markdown-renderer.test.tsx`
  - `apps/web/src/pages/__tests__/pdf-upload.test.tsx`
  - `apps/web/src/pages/__tests__/work-notes.test.tsx`
  - `apps/web/src/pages/work-notes/components/__tests__/view-work-note-dialog.test.tsx`
  - `apps/web/src/pages/work-notes/components/__tests__/work-note-file-list.test.tsx`
  - `tests/integration/project-work-notes.test.ts`
  - `tests/integration/work-note-file-view.test.ts`
  - `tests/integration/work-note-gdrive-integration.test.ts`
  - `tests/integration/work-note-project-association.test.ts`
  - `tests/unit/pdf-extraction-service.test.ts`
  - `tests/unit/pdf-job-repository.test.ts`
  - `tests/unit/work-note-file-service.test.ts`
  - `tests/unit/work-note-file-utils.test.ts`
  - `tests/unit/work-note-repository.associations.test.ts`
  - `tests/unit/work-note-repository.crud.test.ts`
  - `tests/unit/work-note-repository.read.test.ts`
  - `tests/unit/work-note-repository.versions.test.ts`
  - `tests/unit/work-note-service.test.ts`
  - `tests/unit/work-notes-sort.test.ts`

- projects (13)
  - `apps/web/src/hooks/__tests__/use-projects.errors.test.ts`
  - `apps/web/src/hooks/__tests__/use-projects.mutations.test.ts`
  - `apps/web/src/hooks/__tests__/use-projects.query.test.ts`
  - `apps/web/src/pages/__tests__/projects.test.tsx`
  - `tests/integration/project-crud.test.ts`
  - `tests/integration/project-files.test.ts`
  - `tests/integration/project-participants.test.ts`
  - `tests/unit/migration-project-management.test.ts`
  - `tests/unit/project-file-service.test.ts`
  - `tests/unit/project-repository.associations.test.ts`
  - `tests/unit/project-repository.crud.test.ts`
  - `tests/unit/project-repository.query.test.ts`
  - `tests/unit/rag-service.project.test.ts`

- todos (10)
  - `apps/web/src/hooks/__tests__/use-task-categories.test.ts`
  - `apps/web/src/hooks/__tests__/use-todos.test.ts`
  - `apps/web/src/pages/__tests__/task-categories.test.tsx`
  - `tests/unit/get-latest-todo-date.test.ts`
  - `tests/unit/group-recurring-todos.test.ts`
  - `tests/unit/todo-grouping.test.ts`
  - `tests/unit/todo-repository-crud.test.ts`
  - `tests/unit/todo-repository-filtering.test.ts`
  - `tests/unit/todo-repository-query.test.ts`
  - `tests/unit/todo-repository-recurrence.test.ts`

- persons-departments (11)
  - `apps/web/src/hooks/__tests__/use-departments.test.ts`
  - `apps/web/src/hooks/__tests__/use-persons.errors.test.ts`
  - `apps/web/src/hooks/__tests__/use-persons.mutations.test.ts`
  - `apps/web/src/hooks/__tests__/use-persons.query.test.ts`
  - `apps/web/src/lib/mappers/department.test.ts`
  - `apps/web/src/pages/__tests__/departments.test.tsx`
  - `apps/web/src/pages/__tests__/person-dialog.test.tsx`
  - `apps/web/src/pages/__tests__/persons.test.tsx`
  - `tests/unit/api-departments.test.ts`
  - `tests/unit/department-repository.test.ts`
  - `tests/unit/person-repository.test.ts`

- search-rag (9)
  - `apps/web/src/hooks/__tests__/use-rag.test.ts`
  - `apps/web/src/hooks/__tests__/use-search.test.ts`
  - `apps/web/src/pages/__tests__/rag.test.tsx`
  - `apps/web/src/pages/__tests__/search.test.tsx`
  - `apps/web/src/pages/search/search-query.test.ts`
  - `tests/search.test.ts`
  - `tests/unit/chunking.test.ts`
  - `tests/unit/fts-search-service.test.ts`
  - `tests/unit/hybrid-search-service.test.ts`

- ai-embeddings (7)
  - `apps/web/src/hooks/__tests__/use-ai-draft-form.test.ts`
  - `apps/web/src/hooks/__tests__/use-ai-draft.test.ts`
  - `tests/integration/admin-embedding-failures.test.ts`
  - `tests/unit/ai-draft-service.test.ts`
  - `tests/unit/embedding-processor.batch.test.ts`
  - `tests/unit/embedding-retry-queue-repository.test.ts`
  - `tests/unit/embedding-service.test.ts`

- integrations (7)
  - `apps/web/src/hooks/__tests__/use-calendar.test.ts`
  - `apps/web/src/pages/dashboard/components/__tests__/week-calendar.test.tsx`
  - `tests/integration/calendar-routes.test.ts`
  - `tests/unit/google-calendar-service.test.ts`
  - `tests/unit/google-drive-service.test.ts`
  - `tests/unit/google-oauth-service.test.ts`
  - `tests/unit/migrate-r2-to-gdrive.test.ts`

- statistics-dashboards (5)
  - `apps/web/src/pages/__tests__/dashboard.test.tsx`
  - `apps/web/src/pages/__tests__/statistics.test.tsx`
  - `apps/web/src/pages/statistics/hooks/__tests__/use-statistics.test.ts`
  - `tests/integration/statistics-routes.test.ts`
  - `tests/unit/statistics-repository.test.ts`

- auth-system (3)
  - `tests/integration/error-handling.test.ts`
  - `tests/integration/system-routes.test.ts`
  - `tests/unit/auth.test.ts`

- validation-schemas (2)
  - `tests/unit/schemas.test.ts`
  - `tests/unit/validation-middleware.test.ts`

- ui-infra (8)
  - `apps/web/src/components/layout/__tests__/app-layout.test.tsx`
  - `apps/web/src/components/layout/__tests__/header.test.tsx`
  - `apps/web/src/components/layout/__tests__/sidebar.test.tsx`
  - `apps/web/src/hooks/__tests__/use-debounced-value.test.ts`
  - `apps/web/src/hooks/__tests__/use-sidebar-collapse.test.ts`
  - `apps/web/src/hooks/__tests__/use-toast.test.ts`
  - `apps/web/src/test/pwa-config.test.ts`
  - `apps/web/src/test/setup.test.tsx`

- utilities (4)
  - `apps/web/src/lib/api.test.ts`
  - `apps/web/src/lib/date-utils.test.ts`
  - `apps/web/src/lib/utils.test.ts`
  - `tests/unit/date-utils.test.ts`

### Validity Rubric (to be applied per suite in Phase B)
- Behavior-only assertions (no constructor/mock wiring checks).
- Observable effects or outputs asserted.
- Deterministic setup (no time/network flakiness).
- Minimal mocking; integration coverage for boundary behaviors.

---

## 2026-01-22 Phase B Findings (Manual Heuristics)

### Candidates to Merge/Delete (low behavioral value; verify before changes)
- `apps/web/src/test/setup.test.tsx`: tests test helpers only (`toBeDefined`, provider wiring); recommend delete or fold into a single smoke test if needed.
- `apps/web/src/pages/__tests__/dashboard.test.tsx`: trivial render/placeholder checks with mocked child; consider removing or merging into a higher-value UI flow test.
- `apps/web/src/components/layout/__tests__/app-layout.test.tsx`: multiple structural assertions (child render, header/sidebar presence, icon checks); consider reducing to 1–2 behavior tests (toggle + aria labels) and drop the rest.
- `tests/unit/api-departments.test.ts`: small API client query-string checks likely overlap with `apps/web/src/lib/api.test.ts`; consider merging to reduce file count.
- `apps/web/src/components/layout/__tests__/sidebar.test.tsx`: large block of static rendering assertions; consider trimming to focused behavior (collapsed state + Drive status actions), moving static text/link presence to one snapshot or a small subset.

### Likely Flaky / Time-Sensitive Tests (candidate stabilization)
- `tests/unit/date-utils.test.ts`: explicitly uses current date because `vi.setSystemTime` isn’t available; risk around year/week boundaries and timezones.
- `apps/web/src/pages/__tests__/work-notes.test.tsx`: uses `new Date()` + `startOfWeek` for tab grouping; could fail around midnight/week boundaries.
- `tests/unit/todo-repository-filtering.test.ts` and `tests/unit/todo-repository-recurrence.test.ts`: rely on `new Date()` comparisons (today/tomorrow/overdue); risk around date rollovers and timezones.
- `tests/unit/work-note-repository.crud.test.ts` and `tests/unit/person-repository.test.ts`: `setTimeout(10)` to force timestamp ordering; may be flaky on slow/loaded CI.
- `tests/unit/embedding-processor.batch.test.ts`: uses real `setTimeout` to assert parallel execution; may be slow/flaky under load.
- `tests/search.test.ts` and `tests/unit/group-recurring-todos.test.ts`: `Math.random()` in test data; not currently asserted on randomness, but reduces determinism.

### Top 5 Suites to Prioritize for Cleanup (size + complexity)
- `apps/web/src/lib/api.test.ts` (789 lines): consolidate endpoint expectations; prune redundant param validation.
- `tests/unit/statistics-repository.test.ts` (686 lines): split by query type (summary vs distributions) or reduce overlapping fixtures.
- `tests/unit/ai-draft-service.test.ts` (677 lines): split by generation, caching, and error handling.
- `tests/unit/person-repository.test.ts` (668 lines): split CRUD vs import vs associations; remove timing hacks if possible.
- `tests/unit/work-note-file-service.test.ts` (661 lines): split upload vs download/view vs cleanup paths.

### Next Verification Steps (Phase B completion)
- Walk each candidate file and confirm whether assertions are structural-only before removal.
- For time-sensitive suites, introduce fixed clocks or deterministic fixtures where feasible.
- Track each decision (delete/merge/stabilize) with file paths and rationale here before making changes.

### Candidate Review Decisions (2026-01-22)
- `apps/web/src/test/setup.test.tsx`: **Delete**. Tests only verify test utilities wiring (QueryClient/Router wrappers) with `toBeDefined`/provider checks; low behavioral value.
- `apps/web/src/pages/__tests__/dashboard.test.tsx`: **Delete or fold** into a higher-value dashboard flow test. Current test only asserts static render with mocked child.
- `apps/web/src/components/layout/__tests__/app-layout.test.tsx`: **Trim** to 1–2 behavior tests (toggle button action + aria label). Remove child/header/sidebar presence + icon existence checks.
- `tests/unit/api-departments.test.ts`: **Delete** after confirming duplication with `apps/web/src/lib/api.test.ts` (`API.getDepartments` already verifies query params + abort signal). `APIClient` isn’t referenced elsewhere in tests.
- `apps/web/src/components/layout/__tests__/sidebar.test.tsx`: **Trim**. Keep connect/disconnect behavior + collapsed state attribute; remove static navigation link/text assertions.

### Phase B Execution Update (2026-01-22)
- Deleted: `apps/web/src/test/setup.test.tsx`, `apps/web/src/pages/__tests__/dashboard.test.tsx`, `tests/unit/api-departments.test.ts`.
- Trimmed: `apps/web/src/components/layout/__tests__/app-layout.test.tsx`, `apps/web/src/components/layout/__tests__/sidebar.test.tsx`.

### Stabilization Actions (2026-01-22)
- Fixed-clock overrides for deterministic "now": `tests/unit/date-utils.test.ts`, `tests/unit/todo-repository-filtering.test.ts`, `tests/unit/todo-repository-recurrence.test.ts`, `apps/web/src/pages/__tests__/work-notes.test.tsx`.
- Replaced `setTimeout`-based timestamp checks with explicit DB timestamps: `tests/unit/work-note-repository.crud.test.ts`, `tests/unit/person-repository.test.ts`.
- Removed randomness from test data: `tests/search.test.ts`, `tests/unit/group-recurring-todos.test.ts`.
- Made batch timing test deterministic via fake timers: `tests/unit/embedding-processor.batch.test.ts`.

## Category 1: Trivial Tests (Mock State Validation Only)

### Problem
Tests that verify constructor or mock setup rather than real behavior.

### Examples

#### `tests/unit/errors.test.ts` (60 lines)
- **Issue**: Tests error class constructors and property mapping (errors.code, errors.statusCode).
- **Root Cause**: Error classes are simple data holders with no logic.
- **Verdict**: **MERGE into `tests/unit/api-departments.test.ts`** or equivalent integration test where actual errors are thrown and caught.
- **Impact**: Reduce from 60 → ~10 lines by removing redundant property assertions; keep only one complete end-to-end error test.

#### `tests/unit/validation.test.ts` (275 lines)
- **Issue**: Tests middleware attachment to Hono context; duplicates schema validation already covered in `tests/unit/schemas.test.ts`.
- **Examples**: 
  - Tests like `bodyValidator(schema)(mockContext, next)` validate internal middleware wiring, not behavior.
  - Schema validation tests (`validateBody`, `validateQuery`) replicate Zod's own logic.
- **Verdict**: **CONSOLIDATE**: Keep only middleware integration tests (context.set/get flow); remove mock schema tests.
- **Action**: Merge context attachment tests into a single "Validation Middleware" suite; delete duplicate schema tests.

#### `apps/web/src/test/factories.test.ts` (180 lines)
- **Issue**: Tests that factory functions return objects with expected defaults.
- **Root Cause**: Factories are dumb builders; testing `createWorkNote().id` matches regex is trivial.
- **Verdict**: **DELETE** (factories should have zero test coverage unless they have complex logic).
- **Reason**: Factories are used in integration/hook tests; real behavior is tested there. Unit testing factory setup is noise.

---

## Category 2: Duplicated Tests

### Problem
Same assertions tested across multiple files or in similar structures.

#### `preserveLineBreaksForMarkdown` (tested twice)
- **Location 1**: `tests/unit/text-format.test.ts` (27 lines)
- **Location 2**: `apps/web/src/lib/utils.test.ts` (lines 133–155)
- **Issue**: Identical test cases in two files.
- **Verdict**: **DELETE `tests/unit/text-format.test.ts`** entirely; keep only the web-side tests.

#### Schema Validation Tests (redundancy with middleware)
- `tests/unit/schemas.test.ts` tests Zod schema constraints (e.g., "schema requires title").
- `tests/unit/validation.test.ts` tests the *same* schemas wrapped in middleware (e.g., "validateBody throws for invalid schema").
- **Verdict**: Keep `schemas.test.ts`; delete schema-related tests from `validation.test.ts`.

#### Utility Function Tests
- `cn()`, `formatDateWithYear()`, `getDepartmentColor()`, etc. in `apps/web/src/lib/utils.test.ts`.
- Most are basic formatter tests with trivial logic (string concat, date formatting).
- **Verdict**: **KEEP** (formatters are legitimate behavior), but consolidate with `date-utils.test.ts` if overlap exists.

---

## Category 3: Oversized Suites (Need Splitting)

### High Priority (800+ lines)

#### `tests/unit/work-note-repository.test.ts` (908 lines)
- **Current Coverage**: findById, findByIdWithDetails, findByIdWithAssociations, getVersions, findAll (paginated, filtered), search, create, update, delete, versioning, person associations, work note relations.
- **Verdict**: **SPLIT into 5 suites**:
  1. `work-note-repository.read.test.ts` (findById, findByIdWithDetails, findAll)
  2. `work-note-repository.crud.test.ts` (create, update, delete)
  3. `work-note-repository.versions.test.ts` (getVersions, pruneVersions)
  4. `work-note-repository.associations.test.ts` (person, relations)
  5. `work-note-repository.search.test.ts` (search, hybrid search)

#### `tests/unit/todo-repository.test.ts` (887 lines)
- **Current Coverage**: CRUD, filtering, recurrence, grouping, views.
- **Verdict**: **SPLIT into 4 suites**:
  1. `todo-repository.crud.test.ts`
  2. `todo-repository.recurrence.test.ts`
  3. `todo-repository.filtering.test.ts`
  4. `todo-repository.grouping.test.ts`

#### `tests/unit/project-repository.test.ts` (782 lines)
- **Verdict**: **SPLIT into 3 suites**:
  1. `project-repository.crud.test.ts`
  2. `project-repository.associations.test.ts`
  3. `project-repository.files.test.ts`

#### `apps/web/src/hooks/__tests__/use-projects.test.ts` (990 lines)
- **Current Coverage**: fetch list, CRUD mutations, error handling, filtering, pagination.
- **Verdict**: **SPLIT into 4 suites**:
  1. `use-projects.query.test.ts` (fetch, filtering, pagination)
  2. `use-projects.mutations.test.ts` (create, update, delete)
  3. `use-projects.errors.test.ts` (error handling, toast feedback)

#### `apps/web/src/hooks/__tests__/use-work-notes.test.ts` (717 lines)
- **Verdict**: **SPLIT into 3 suites**:
  1. `use-work-notes.query.test.ts`
  2. `use-work-notes.mutations.test.ts`
  3. `use-work-notes.errors.test.ts`

#### `apps/web/src/hooks/__tests__/use-persons.test.ts` (609 lines)
- **Verdict**: **SPLIT into 3 suites**.

### Medium Priority (500–700 lines)

#### `tests/unit/ai-draft-service.test.ts` (677 lines)
- **Verdict**: Keep as-is; split only if concerns (generation, caching, error handling) exceed 3 each.

#### `tests/unit/person-repository.test.ts` (668 lines)
- **Verdict**: **SPLIT into 2 suites**:
  1. `person-repository.crud.test.ts`
  2. `person-repository.import.test.ts` (reuses existing import tests from `tests/person.test.ts`)

---

## Category 4: Fixture-Only / Setup-Heavy Tests

### Problem
Tests with extensive setup but minimal assertions.

#### `tests/unit/google-drive-service.test.ts` (550 lines)
- **Setup**: Mock OAuth, Drive client, multiple file operations.
- **Assertions**: Often single-line checks.
- **Verdict**: **KEEP** (integration tests must have setup); consider moving to integration test suite separate from unit.

#### `tests/unit/google-calendar-service.test.ts` (550 lines)
- **Verdict**: **KEEP** (same reason).

---

## Category 5: Internal Plumbing Tests

### Problem
Tests that only verify internal implementation details (mocks, private methods) rather than public contract.

#### `tests/unit/embedding-processor.batch.test.ts` (many tests)
- Tests batch operation internals.
- **Verdict**: Keep **only** end-to-end batch behavior; remove internal queue/timing assertions.

#### `tests/unit/migration-project-management.test.ts` (329 lines)
- Migration-specific logic.
- **Verdict**: Keep if covers post-migration state; remove if only mocks upstreamAPIs.

---

## Redundancy Summary Table

| File | Lines | Issue | Action |
|------|-------|-------|--------|
| `tests/unit/errors.test.ts` | 60 | Mock state validation | Merge into integration tests |
| `tests/unit/validation.test.ts` | 275 | Middleware + schema duplication | Consolidate (split concerns) |
| `tests/unit/text-format.test.ts` | ~27 | Duplicate of utils tests | DELETE |
| `apps/web/src/test/factories.test.ts` | 180 | Trivial builder tests | DELETE |
| `tests/unit/work-note-repository.test.ts` | 908 | Oversized (5 concerns) | SPLIT into 5 suites |
| `tests/unit/todo-repository.test.ts` | 887 | Oversized (4 concerns) | SPLIT into 4 suites |
| `tests/unit/project-repository.test.ts` | 782 | Oversized (3 concerns) | SPLIT into 3 suites |
| `apps/web/src/hooks/__tests__/use-projects.test.ts` | 990 | Oversized (3 concerns) | SPLIT into 3 suites |
| `apps/web/src/hooks/__tests__/use-work-notes.test.ts` | 717 | Oversized (3 concerns) | SPLIT into 3 suites |
| `apps/web/src/hooks/__tests__/use-persons.test.ts` | 609 | Oversized (3 concerns) | SPLIT into 3 suites |

---

## Recommendations (Prioritized)

### Phase 1: Delete Trivial Tests
1. Delete `apps/web/src/test/factories.test.ts` (180 lines)
2. Delete `tests/unit/text-format.test.ts` (27 lines)
3. **Savings**: ~207 lines, eliminates noise

### Phase 2: Consolidate Mock Tests
1. Merge `tests/unit/errors.test.ts` into integration/API tests
2. Consolidate `tests/unit/validation.test.ts`: keep middleware, remove schema validation duplication
3. **Savings**: ~100 lines of redundant assertions

### Phase 3: Split Oversized Suites
1. Split repository tests (work-note, todo, project): 2,577 → 4,000 lines (more readable, focused suites)
2. Split hook tests (use-projects, use-work-notes, use-persons): 2,316 → 3,000+ lines
3. **Impact**: Reduce cognitive load; keep test count same but organize by behavior

### Phase 4: Establish Test Structure Standard
- Organize by concern (query, mutations, errors)
- Max 400 lines per file
- Reusable fixtures/helpers in `tests/helpers/` or `apps/web/src/test/`

---

## Estimated Impact
- **Lines Removed**: ~300 (trivial + duplicate tests)
- **Lines Reorganized**: ~5,000+ (split large suites)
- **Test Count**: Stays ~60+ files; readability and maintenance improve significantly
- **Execution Time**: No change (same test count and logic)
