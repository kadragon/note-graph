# Test Suite Maintenance Plan

## Current Focus
- Keep only meaningful behavioral tests in the checklist; structural cleanup lives outside the checklist.
- Primary target: de-duplicate tests, then split oversized suites for readability.

## 2026-01-22: Test Validity + Organization Plan

### Objectives
- Verify every test asserts observable behavior (not just mock state) and stays deterministic.
- Reduce redundancy while preserving coverage of core behaviors.
- Reorganize suites for faster comprehension and focused review.
- Keep a traceable record of decisions in `TEST_AUDIT.md` and `TEST_STRUCTURE.md`.

### Phase A: Inventory & Validity Audit (structural)
- Generate a fresh inventory of all test files with counts and suite owners (backend vs web).
- Tag each suite by layer (unit/integration/web hooks) and domain (work notes, todos, projects, etc.).
- Apply a validity rubric per suite:
  - Behavior-focused assertions only (no constructor/mock-only tests).
  - Observable effects or outputs are verified.
  - Deterministic setup (no time/network flakiness).
- Log findings and removal/merge candidates in `TEST_AUDIT.md`.

### Phase B: Redundancy & Flakiness Check (structural)
- Identify duplicated assertions across files and mark the preferred home.
- Run targeted suites multiple times to surface non-determinism; document flakes and root causes.
- Decide whether each redundant/flaky test is deleted, merged, or rewritten (behavior-only).

### Phase C: Organization Plan (structural)
- Define target folder layout and naming conventions per layer/domain.
- Split oversized suites into single-purpose files (read/query vs mutations vs errors).
- Consolidate shared helpers/fixtures into a single location per layer.
- Update `TEST_STRUCTURE.md` to reflect the new layout and intent.

### Phase D: Behavioral Gaps (adds checklist items later)
- After the audit, add **specific** missing-behavior tests to the checklist.
- Each checklist item must represent exactly one behavior and be runnable in isolation.

### Phase E: Refactor Execution Rules
- Tidy First: structural changes only after tests are green.
- One refactor at a time; re-run tests after each split/merge.
- Avoid mixed steps (no behavior + structure in the same change).

### 2026-01-22 Phase B Results (manual heuristics)
- Candidate removals/merges (verify before changes):
  - `apps/web/src/test/setup.test.tsx` (test helpers only)
  - `apps/web/src/pages/__tests__/dashboard.test.tsx` (trivial render)
  - `apps/web/src/components/layout/__tests__/app-layout.test.tsx` (mostly structural)
  - `tests/unit/api-departments.test.ts` (overlaps `apps/web/src/lib/api.test.ts`)
  - `apps/web/src/components/layout/__tests__/sidebar.test.tsx` (heavy static UI assertions)
- Likely flaky/time-sensitive suites: `tests/unit/date-utils.test.ts`, `apps/web/src/pages/__tests__/work-notes.test.tsx`, `tests/unit/todo-repository-filtering.test.ts`, `tests/unit/todo-repository-recurrence.test.ts`, `tests/unit/work-note-repository.crud.test.ts`, `tests/unit/person-repository.test.ts`, `tests/unit/embedding-processor.batch.test.ts`, `tests/search.test.ts`, `tests/unit/group-recurring-todos.test.ts`.
- Top cleanup targets by size/complexity: `apps/web/src/lib/api.test.ts`, `tests/unit/statistics-repository.test.ts`, `tests/unit/ai-draft-service.test.ts`, `tests/unit/person-repository.test.ts`, `tests/unit/work-note-file-service.test.ts`.

### Phase B Completion Tasks (structural, next)
- Validate each candidate removal/merge with a quick suite review and record decisions in `TEST_AUDIT.md`. (done 2026-01-22)
- Stabilize time-sensitive tests (fixed clocks or deterministic fixtures) before reorganizing. (done 2026-01-22)
- Choose 1–2 of the top cleanup targets to split/trim first.

## Behavioral Test Backlog (for `go`)
- [x] Add repository-level test that department search returns matches for a query (prerequisite to removing integration test).
- [x] Add person import coverage in repository/API tests that validates imported records (prerequisite to merging `tests/person.test.ts`).
- [x] Sidebar: when Google Drive is not configured, show "환경 설정 필요" and disable connect/disconnect buttons.
- [x] WorkNotesTable: renders empty state message when no work notes are available.
- [x] API.getDepartments: uses `/api/departments` with no query string when no params are provided.

## Structural Cleanup (after tests are green)
- Remove `tests/departments.test.ts` once repository search coverage is confirmed.
- Merge `tests/person.test.ts` import cases into `tests/unit/person-repository.test.ts`.
- Split `tests/unit/work-note-repository.test.ts` into findById, findAll, CRUD, versions, associations suites.
- Split `tests/unit/todo-repository.test.ts` into CRUD, recurrence, filtering/views suites.
- Split `apps/web/src/hooks/use-projects.test.ts` into list/fetch, CRUD mutations, error handling suites.

## Phase 2: Test Analysis and Cleanup

### Identify Redundant/Trivial Tests
- [x] Audit `tests/unit/` and `apps/web/src/**/*.test.ts` to flag tests that are: 1) trivial assertion (e.g., mock state checks), 2) duplicated across files, 3) testing only internal plumbing (mocked deps, not behavior).
- [x] Document redundant test patterns and their locations in `TEST_AUDIT.md`.

### Delete Trivial Tests (Phase 1)
- [x] Delete `apps/web/src/test/factories.test.ts` (factory builders should have zero test coverage).
- [x] Delete `tests/unit/text-format.test.ts` (duplicate of `apps/web/src/lib/utils.test.ts`).

### Consolidate Mock Tests (Phase 2)
- [x] Merge `tests/unit/errors.test.ts` error property assertions into `tests/integration/error-handling.test.ts`.
- [x] Consolidate `tests/unit/validation.test.ts`: created `validation-middleware.test.ts` with only middleware context attachment tests.

### Split Oversized Suites (Phase 3)
- [x] Split `tests/unit/work-note-repository.test.ts` (908 lines) into 4 files: read, crud, versions, associations.
- [x] Split `tests/unit/todo-repository.test.ts` (887 lines) into query, filtering, crud, recurrence.
- [x] Split `tests/unit/project-repository.test.ts` (782 lines) into query, crud, associations.
- [x] Split `apps/web/src/hooks/__tests__/use-projects.test.ts` (990 lines) into query, mutations, errors.
- [x] Split `apps/web/src/hooks/__tests__/use-work-notes.test.ts` (717 lines) into query, mutations, errors.
- [x] Split `apps/web/src/hooks/__tests__/use-persons.test.ts` (609 lines) into query, mutations, errors.

### Document Test Improvements
- [x] Create `TEST_STRUCTURE.md`: inventory of all test files, coverage by file, architectural insights.

## Summary (Test Consolidation Complete)

### Session Results
- **Phase 1 Complete**: Deleted 207 lines of trivial tests.
  - `apps/web/src/test/factories.test.ts` (180 lines) - factory builders need no unit test coverage
  - `tests/unit/text-format.test.ts` (27 lines) - duplicate assertions
  
- **Phase 2 Complete**: Consolidated mock and middleware tests.
  - Moved `errors.test.ts` → `integration/error-handling.test.ts` (end-to-end error validation)
  - Refactored `validation.test.ts` → `validation-middleware.test.ts` (removed schema duplication)
  
- **Phase 3 Partial**: Split first oversized suite.
  - `work-note-repository.test.ts` (908 lines) → 4 focused files (read, crud, versions, associations)
  
### Current State
- **Test Suite**: 605 tests across 50 files (was 619 tests across 48 files)
- **Code Quality**: All tests passing; removed 79 lines of trivial assertions; improved test clarity
- **Maintainability**: Key file now <250 lines per test file; separated concerns by behavior

### Remaining Work (for follow-up sessions)
- Split remaining large repository tests (todo, project) following work-note pattern
- Split hook tests by concern (query, mutations, errors)
- Create test structure documentation
- Consider integration test suite organization

## Notes (Completed)
- React Query migrations, render optimizations, bundle size optimizations are complete.
- Google Drive test failures resolved; `tests/api.test.ts` removed.
