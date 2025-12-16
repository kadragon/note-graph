# TASK-067: Fix Statistics Date Range Bug for Recurring Todos

**Trace**: spec_id=SPEC-stats-1

## Problem

When calculating statistics, the `completedTodoCount` in work notes includes ALL completed todos regardless of the selected time period. This causes incorrect counts for recurring todos:

- User completes a recurring todo 4 times this week
- The same todo was completed 40 times in the past
- Statistics shows 44 completed todos instead of 4

## Root Cause

In `apps/worker/src/repositories/statistics-repository.ts:87-88`, the subquery counting completed todos does not apply the date range filter:

```sql
(SELECT COUNT(*) FROM todos t WHERE t.work_id = wn.work_id AND t.status = '완료') as completedTodoCount
```

This counts ALL completed todos, not just those within the `startDate` to `endDate` range.

## Solution

Refactor to use CTE (Common Table Expression) instead of correlated subqueries for better performance.

## Implementation Steps

1. ✅ Write failing test in `tests/unit/statistics-repository.test.ts` reproducing the bug
2. ✅ Refactor SQL to use CTE (`PeriodTodos`) with date range filtering
3. ✅ Use conditional aggregation (`SUM(CASE WHEN...)`) for counting
4. ✅ Verify all existing tests still pass (590/590)
5. ✅ Update `.governance/memory.md`

## Performance Optimization

Based on PR review feedback, the implementation uses CTE instead of correlated subqueries:
- **Before**: Correlated subqueries executed per row (O(n) performance degradation)
- **After**: Single table scan with pre-aggregation in CTE (O(1) performance per row)

## Acceptance Criteria

- ✅ Test case for recurring todos with historical completions passes
- ✅ `completedTodoCount` only counts todos completed within date range
- ✅ `totalTodoCount` only counts todos relevant to the period (not all todos)
- ✅ All existing statistics tests pass
- ✅ No regression in statistics features

## Notes

This is a critical bug affecting data accuracy in statistics dashboard, especially for users with recurring todos.
