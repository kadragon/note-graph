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
- [ ] Split `tests/unit/todo-repository.test.ts` (887 lines) into 4 files: crud, recurrence, filtering, grouping.
- [ ] Split `tests/unit/project-repository.test.ts` (782 lines) into 3 files: crud, associations, files.
- [ ] Split `apps/web/src/hooks/__tests__/use-projects.test.ts` (990 lines) into 3 files: query, mutations, errors.
- [ ] Split `apps/web/src/hooks/__tests__/use-work-notes.test.ts` (717 lines) into 3 files: query, mutations, errors.
- [ ] Split `apps/web/src/hooks/__tests__/use-persons.test.ts` (609 lines) into 3 files: query, mutations, errors.

### Document Test Structure
- [ ] Create `TEST_STRUCTURE.md`: inventory of all test files, what each covers, no remaining redundancy.

## Summary (Session Complete)
- **Phase 1**: Deleted 207 lines of trivial tests (factories, text-format duplication).
- **Phase 2**: Consolidated mock tests; merged errors into integration; split validation into middleware-focused file.
- **Phase 3 (partial)**: Split work-note-repository from 908 lines into 4 focused test files (read, crud, versions, associations).
- **Result**: Test suite is 605 tests, 50 files, more maintainable. Remaining splits (todo, project, hooks) deferred for follow-up.

## Notes (Completed)
- React Query migrations, render optimizations, bundle size optimizations are complete.
- Google Drive test failures resolved; `tests/api.test.ts` removed.
