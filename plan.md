## Statistics - Numeric todo counts in API summary

> Keep statistics API todo counts numeric when aggregate rows come back as strings from PostgreSQL.

- [x] Repository returns numeric todo counts when DB aggregate fields arrive as strings
- [x] Summary totals remain numeric across multiple work notes

## Test Reliability - PDF generation test network isolation

> Keep web tests deterministic by removing external CDN/network dependency in the PDF generation test.

- [ ] Mock/stub external font fetch in generate-work-note-pdf test so it passes without internet access

## Persons Import - PostgreSQL boolean writes

> Keep person import working against PostgreSQL by writing boolean literals for `is_active` columns.

- [x] Import repository writes PostgreSQL-safe boolean values when auto-creating departments and department history

## D1 Removal - PR 2: Repository SQL to native PostgreSQL

> Convert all repository SQL from D1 style (?) to PostgreSQL native ($1, $2, ...).

- [x] `db-utils.ts` uses PostgreSQL placeholder helpers and PostgreSQL-safe variable limits
- [x] Repository SQL uses PostgreSQL `$N` placeholders across settings, departments, task categories, groups, PDF jobs, embedding retry queue, Google OAuth, persons, meeting minutes, statistics, todos, and work notes
- [ ] Remaining non-repository SQL callers use PostgreSQL `$N` placeholders directly (`base-file-service`, search services, meeting-minute routes, PostgreSQL FTS dialect)

## D1 Removal - PR 3: Test files to PGlite

> Switch all test files from D1/Miniflare to PGlite-based testing.

- [x] `vitest.config.ts` uses standard `defineConfig` with `tests/pg-setup.ts`
- [x] Worker unit and integration tests run through PGlite-backed setup/helpers
- [x] PostgreSQL boolean and timestamp expectations are reflected in the migrated tests

## D1 Removal - PR 4: D1 code and translation layer removal

> Remove all D1-specific code and the SQL translation layer.

- [x] Remove D1 fallback wiring from `database-factory`, `env.ts`, and test env helpers so runtime selection is PostgreSQL-only
- [x] Delete D1-only adapters and legacy test setup once no production or test code imports them
- [x] Remove SQL placeholder/function translation from `supabase-database-client` after the last `?`-based callers are converted
- [x] Update D1-specific scripts and Wrangler/package configuration to the PostgreSQL path
- [x] Remove stale D1/Miniflare documentation in repo docs and test docs

## D1 Removal - PR 5: Cleanup and optimization

> Final cleanup and PostgreSQL-native optimizations.

- [x] Simplify `FtsDialect` and search code after D1 dialect removal
- [x] Audit remaining SQLite-isms (`json_each`, D1 comments, `?` SQL snippets) and replace them with PostgreSQL-native equivalents
- [x] Update governance/docs snapshots after the PostgreSQL migration lands cleanly
