# Backlog

TDD test backlog. Each feature has acceptance criteria agreed before coding.

## Fix Route-to-Repository Direct Import Violations

> Goal: Routes must access repositories only through services or middleware-injected context, never via direct import.
> Design: docs/architecture.md (Dependency Rule #1)
> Done-when: Structural test `structural-layer-imports.test.ts` passes with zero violations.

- [ ] `routes/todos.ts` — remove direct `WorkNoteRepository` import, move logic to service
- [ ] `routes/meeting-minutes.ts` — remove direct imports of `MeetingMinuteRepository`, `PersonRepository`, `TaskCategoryRepository`, move logic to service
- [ ] `routes/daily-reports.ts` — remove direct `DailyReportRepository` import, move logic to service

## queryInChunks Transaction Integration

> Goal: Eliminate manual chunking duplication in todo-repository by reusing `queryInChunks` within transaction contexts.
> Design: N/A (refactoring)
> Done-when: All manual chunking loops in `todo-repository.ts` replaced with `queryInChunks`, tests pass, transaction safety preserved.

- [x] Make `queryInChunks` accept optional transaction client parameter
- [x] Replace manual chunking in `batchSetDueDates` with `queryInChunks`
- [x] Replace manual chunking in `batchPostponeDueDates` with `queryInChunks`
- [x] Verify transaction rollback still works with chunked queries
