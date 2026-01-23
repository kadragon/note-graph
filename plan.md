# Test Suite Maintenance Plan (Compact)

## Current Focus
- Keep only meaningful behavioral tests in the checklist; structural cleanup lives outside the checklist.
- De-duplicate tests and keep suites focused and readable.
- Record decisions in `TEST_AUDIT.md` and `TEST_STRUCTURE.md`.

## Active Behavioral Tests (for `go`)
- [x] PWA 설정에서 `/api` 요청은 SW 캐시에서 제외되어 NetworkOnly로 동작한다
- [x] PWA에서 업데이트 확인/적용을 위해 virtual:pwa-register로 자동 업데이트 체크와 안내 UI를 제공한다
- [x] PWA 업데이트 체크가 1시간 간격으로 반복 호출된다

## Structural Cleanup (after tests are green)
- Remove `tests/departments.test.ts` once repository search coverage is confirmed.
- Merge `tests/person.test.ts` import cases into `tests/unit/person-repository.test.ts`.

## Completed Behavioral Tests (archived)
- [x] Add repository-level test that department search returns matches for a query.
- [x] Add person import coverage in repository/API tests that validates imported records.
- [x] Sidebar: when Google Drive is not configured, show "환경 설정 필요" and disable connect/disconnect buttons.
- [x] WorkNotesTable: renders empty state message when no work notes are available.
- [x] API.getDepartments: uses `/api/departments` with no query string when no params are provided.

## Completed Structural Work (summary)
- Deleted trivial tests: `apps/web/src/test/factories.test.ts`, `tests/unit/text-format.test.ts`.
- Consolidated mock/middleware tests: moved errors into integration suite; replaced validation unit test with middleware-focused test.
- Split oversized suites: work-note repository, todo repository, project repository, and web hook tests for projects/work notes/persons.
- Documented test layout and audit results in `TEST_STRUCTURE.md` and `TEST_AUDIT.md`.

## Notes
- React Query migrations, render optimizations, bundle size optimizations are complete.
- Google Drive test failures resolved; `tests/api.test.ts` removed.
