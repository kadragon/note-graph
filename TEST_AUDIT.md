# Test Suite Audit Report

## Summary
- **Total Unit Tests**: ~36 files in `tests/unit/`, ~26 files in `apps/web/src/**/*.test.ts`
- **Total Lines**: ~12,000 in backend, ~5,900 in frontend
- **Key Finding**: Significant redundancy and triviality that can be consolidated

---

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
