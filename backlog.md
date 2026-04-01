# Backlog

TDD test backlog. Each feature has acceptance criteria agreed before coding.

## queryInChunks Transaction Integration

> Goal: Eliminate manual chunking duplication in todo-repository by reusing `queryInChunks` within transaction contexts.
> Design: N/A (refactoring)
> Done-when: All manual chunking loops in `todo-repository.ts` replaced with `queryInChunks`, tests pass, transaction safety preserved.

- [ ] Make `queryInChunks` accept optional transaction client parameter
- [ ] Replace manual chunking in `batchSetDueDates` with `queryInChunks`
- [ ] Replace manual chunking in `batchPostponeDueDates` with `queryInChunks`
- [ ] Verify transaction rollback still works with chunked queries
