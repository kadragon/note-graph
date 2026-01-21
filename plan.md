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

## Notes (Completed)
- React Query migrations, render optimizations, bundle size optimizations are complete.
- Google Drive test failures resolved; `tests/api.test.ts` removed.
