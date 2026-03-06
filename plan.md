## Statistics - Numeric todo counts in API summary

> Keep statistics API todo counts numeric when aggregate rows come back as strings from PostgreSQL.

- [x] Repository returns numeric todo counts when DB aggregate fields arrive as strings
- [x] Summary totals remain numeric across multiple work notes

## Test Reliability - PDF generation test network isolation

> Keep web tests deterministic by removing external CDN/network dependency in the PDF generation test.

- [ ] Mock/stub external font fetch in generate-work-note-pdf test so it passes without internet access

## D1 Removal - PR 2: Repository SQL to native PostgreSQL

> Convert all repository SQL from D1 style (?) to PostgreSQL native ($1, $2, ...).

- [ ] `db-utils.ts` — queryInChunks placeholders to $N, SQL_VAR_LIMIT → 32767
- [ ] `setting-repository.ts`
- [ ] `department-repository.ts`
- [ ] `task-category-repository.ts`
- [ ] `work-note-group-repository.ts`
- [ ] `pdf-job-repository.ts`
- [ ] `embedding-retry-queue-repository.ts`
- [ ] `google-oauth-repository.ts`
- [ ] `person-repository.ts`
- [ ] `meeting-minute-repository.ts`
- [ ] `statistics-repository.ts`
- [ ] `todo-repository.ts`
- [ ] `work-note-repository.ts`

## D1 Removal - PR 3: Test files to PGlite

> Switch all test files from D1/Miniflare to PGlite-based testing.

- [ ] vitest.config.ts: defineWorkersConfig → defineConfig
- [ ] Convert D1 test imports to PGlite setup
- [ ] Create createTestApp() helper for integration tests
- [ ] Update boolean/timestamp expectations

## D1 Removal - PR 4: D1 code and translation layer removal

> Remove all D1-specific code and the SQL translation layer.

- [ ] Delete D1 adapter files, migrations, scripts
- [ ] Simplify database-factory, supabase-database-client, env.ts
- [ ] Update wrangler.toml and package.json

## D1 Removal - PR 5: Cleanup and optimization

> Final cleanup and PostgreSQL-native optimizations.

- [ ] Update AGENTS.md, simplify FtsDialect
- [ ] Audit SQLite-isms, apply PG optimizations
