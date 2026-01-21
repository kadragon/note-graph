# Analytics & Performance Refactoring Plan

## Analytics Insights
- **No external analytics library** – uses Cloudflare AI Gateway (OpenAI), custom StatisticsService, console logging, DB state columns
- **No duplication detected** – analytics is already centralized
- **Opportunity**: formalize event tracking if real-time observability needed

---

## Web Performance (User-Facing)

### React Query Integration
- [x] useStatistics: migrate from manual useState/useEffect to React Query (useStatistics#L23-L68)
- [x] useGoogleDriveStatus: enable proper caching with staleTime/retry strategy (useWorkNotes#L187-L193)

### Render Optimization
- [x] WorkNotes: split 6-tab memoization into separate computed lists or move to selector (WorkNotes#L66-L112)
- [x] PersonDialog: consolidate 10+ useState fields into a single form reducer (PersonDialog#L56-L65)

### Bundle Size
- [ ] ViewWorkNoteDialog: lazy-load react-markdown + rehype/remark plugins (ViewWorkNoteDialog#L51-L62)

---

## Test Suite Compaction & Maintenance

### Current State
- **563 total test files** across `tests/` and `apps/web/src`
- **589 tests total** (3 currently failing)
- **13,280 lines of test code**
- Large test files: `work-note-repository.test.ts` (908 lines, 59 describe/it), `todo-repository.test.ts` (887 lines, 50 describe/it), `use-projects.test.ts` (990 lines)

### Redundant Test Coverage
- `tests/api.test.ts` (107 lines): basic endpoint tests (health, auth, 404)—covered by route-specific integration tests
- `tests/departments.test.ts` (50 lines): department search—duplicates `tests/unit/department-repository.test.ts` (541 lines)
- `tests/person.test.ts` (188 lines): person creation—overlaps with `person-repository.test.ts` and API integration

### Fix Failing Tests
- [ ] Fix Google Drive service mocking in `google-drive-service.test.ts` (2 failures: folder creation, INSERT OR IGNORE)
- [ ] Fix `migrate-r2-to-gdrive.test.ts` (1 failure: R2 migration test)

### Compact Redundant Tests
- [ ] Delete `tests/api.test.ts` (endpoint coverage exists in route-specific tests)
- [ ] Delete `tests/departments.test.ts` (redundant with `department-repository.test.ts`)
- [ ] Merge `tests/person.test.ts` import tests into `person-repository.test.ts`

### Split Large Test Files
- [ ] Split `work-note-repository.test.ts` (908 lines) into: findById, findAll, CRUD, versions, associations
- [ ] Split `todo-repository.test.ts` (887 lines) into: basic CRUD, recurrence logic, filtering/views
- [ ] Split `use-projects.test.ts` (990 lines) into: list/fetch, CRUD mutations, error handling

---

## Priority Order
1. **Worker N+1 Queries** (highest impact on latency)
2. **Web API Waterfall** (highest impact on user responsiveness)
3. **Fix Failing Tests** (unblocks PR merge)
4. **Compact Redundant Tests** (improves maintainability)
5. **Sequential DB Operations** (improves batch job throughput)
6. **React Query Migrations** (improves cache hit rates)
7. **Render Optimizations** (improves perceived performance)
8. **Bundle Size** (improves initial load)
9. **Split Large Test Files** (improves readability, reduces cognitive load)
