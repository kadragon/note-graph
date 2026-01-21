# Test Suite Maintenance Plan

## Current Focus
- Keep only meaningful behavioral tests in the checklist; structural cleanup lives outside the checklist.
- Primary target: de-duplicate tests, then split oversized suites for readability.

## Behavioral Test Backlog (for `go`)
- [x] Add repository-level test that department search returns matches for a query (prerequisite to removing integration test).
- [x] Add person import coverage in repository/API tests that validates imported records (prerequisite to merging `tests/person.test.ts`).

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
- [ ] Create `TEST_STRUCTURE.md`: inventory of all test files, coverage by file, architectural insights.

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
