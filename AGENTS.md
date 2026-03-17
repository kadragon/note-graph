# AGENTS.md

## Product Context
- This is a single-user, KST-only (UTC+9) application. All server-side timezone defaults (e.g. `timezoneOffset = 540`) assume KST. Multi-timezone support is not a current requirement.

## Operational Constraints
- Workers test coverage remains blocked by `node:inspector` runtime limitations; treat coverage runs as non-authoritative until runtime/tooling support changes.
- Drive-only work note attachments require Google OAuth env vars and `GDRIVE_ROOT_FOLDER_ID`; missing values must fail fast to avoid writing into unexpected Drive locations.

## Operational Gotchas
- In worker integration tests that assert redirects, call `authFetch(..., { redirect: 'manual' })` to validate original `302`/`Location` instead of the followed response.
- For Google Drive delete route integration tests, stub `DELETE https://www.googleapis.com/drive/v3/files/:id`; without the stub, tests can leak to real API calls and fail with auth-driven `500` noise.
- Treat empty or missing `gdrive_folder_id` as unlinked and skip Drive listing; listing with empty IDs produces Drive API errors.
- Accept `application/zip` only for `.hwpx` files; do not broaden ZIP acceptance for other extensions.
