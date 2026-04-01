# Evaluator Criteria

Grading criteria for the evaluator pass. Triggered when all `backlog.md` items under a `## Feature` are `[x]`.

## Thresholds

- **Pass**: All criteria score >= 3/5.
- **Conditional pass**: One criterion at 2/5, rest >= 3/5. Findings become backlog items.
- **Fail**: Any criterion at 1/5 or two+ at 2/5. Must fix and re-evaluate.

## Criteria

### 1. Functional Correctness (weight: high)

Does it do what the spec says?

- 5: All acceptance criteria met, edge cases handled.
- 3: Core path works, minor edge cases missed.
- 1: Core path broken or acceptance criteria unmet.

### 2. Data Integrity (weight: high)

Are DB operations correct and safe?

- 5: Transactions where needed, no orphan data, constraints enforced.
- 3: Works in happy path, missing transaction safety in some paths.
- 1: Data loss possible, missing FK/unique constraints.

### 3. API Contract (weight: high)

Does the API match `packages/shared/types/`?

- 5: Request/response types match shared types exactly. Zod schema validates.
- 3: Types mostly match, minor drift between schema and shared types.
- 1: Frontend would break due to type mismatch.

### 4. Test Coverage (weight: medium)

Are the new paths tested?

- 5: Happy path + error paths + edge cases. Both unit and integration.
- 3: Happy path tested. Some error paths.
- 1: No tests or tests that don't assert meaningful behavior.

### 5. Error Handling (weight: medium)

Are failures handled gracefully?

- 5: Custom error types used, meaningful messages, no silent failures.
- 3: Errors caught but generic messages or missing some paths.
- 1: Unhandled exceptions leak to client.

### 6. Performance (weight: low)

No obvious N+1, unbounded queries, or missing indexes.

- 5: Queries efficient, indexes exist for new columns, pagination used.
- 3: Acceptable for current scale, minor inefficiencies.
- 1: N+1 queries, full table scans, or missing pagination.

### 7. UX Consistency (weight: low, frontend only)

Does the UI follow existing patterns?

- 5: Uses existing components (Radix/shadcn), matches existing page layout.
- 3: Mostly consistent, minor deviations.
- 1: New patterns that conflict with existing UI.

## Evaluator Behavior

- **Skeptical by default** — look for what's broken, not what works.
- **Grade against criteria**, not vibes.
- **Exercise the running application** when possible.
- **Findings below threshold** become new `backlog.md` items with clear reproduction steps.
