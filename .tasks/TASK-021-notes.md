Task: TASK-021 (SPEC-person-1)
Date: 2025-12-01

Outcome:
- Added debounced department search with backend query parameters (q + limit=5) and loading/error indicators in person dialogs (create/edit).
- Spinner shown during fetch; error message displayed when search fails; search resets on close/select.
- Suggestions capped at 5 and keep keyboard navigation via shadcn Command with autofocus.
- `useDepartments` now supports search/limit/enabled; new `useDebouncedValue` hook added.
- API client `getDepartments` accepts query params; exported APIClient for unit testing.

Tests:
- npm test -- tests/unit/api-departments.test.ts
- npm run lint
- npm run typecheck

Notes:
- Keyboard navigation uses existing Command list behaviour (arrow/enter/escape) with autofocus preserved.
