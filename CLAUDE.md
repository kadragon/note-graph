## Repository Structure

```
CLAUDE.md                  # This file. Behavioral rules + pointers.
backlog.md                 # TDD test backlog
tasks.md                   # Non-TDD work: docs, harness, sweep

docs/
├── architecture.md        # Layer map, dependency rules, module registry
├── design/                # Problem → Constraints → Decision → Rejected alternatives
├── quality.md             # Per-domain quality grades, known gaps
├── eval-criteria.md       # Evaluator grading criteria and thresholds
└── runbook.md             # Build, test, deploy, common failures
```

## Quick Reference

- **Package manager**: `bun` (not npm/npx)
- **Dev**: `bun run dev` (frontend :5173 + backend :8787)
- **Test**: `bun run test` (unit) / `bun run test:web` (frontend) / `bun run test:all`
- **Deploy**: `bun run deploy:with-migrations` (always use this for schema changes)
- **Lint**: `bun run lint` / `bun run typecheck`
- **New migration**: `bun run db:create-migration`
