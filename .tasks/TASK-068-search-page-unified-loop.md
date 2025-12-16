# TASK-068: Fix /search unified request loop

**Trace**: spec_id=SPEC-search-ui-1

## Problem

Opening `/search?q=...` can trigger repeated unified search requests, causing repeated error toasts (often mentioning "unified") and eventually a blank/closed UI.

## Hypothesis / Root Cause

`apps/web/src/pages/search/search.tsx` uses an effect that depends on a non-stable mutation object, so the effect re-runs on every render and calls `mutate()` again, creating a render → request → state update loop.

## Solution

- Make the effect depend on a stable `mutate` function reference (not the whole mutation object).
- Add a local guard so the same query does not re-trigger searches even if the effect re-runs due to unrelated renders.
- Add a small unit test for query normalization/guard logic.

## Acceptance Criteria

- No repeated requests on initial load with `q` present
- Exactly one request per `q` change
- No request when `q` is empty

