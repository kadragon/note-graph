# Jest + Miniflare Progressive Migration Plan

**Document Version**: 1.0
**Created**: 2025-12-29
**Status**: Planning
**Related Spec**: SPEC-testing-migration-001

---

## Executive Summary

This document outlines the progressive migration strategy from Vitest + @cloudflare/vitest-pool-workers to Jest + Miniflare for the note-graph project's test suite (39 test files, 614+ tests).

### Why Migrate?

- **Compatibility Issue**: Vitest 3.2+ has compatibility issues with Cloudflare Workers, especially with compatibility date 2025-09-21+ and nodejs_compat flags
- **Ecosystem Maturity**: Jest has more mature Miniflare integration and broader ecosystem support
- **Long-term Stability**: Cloudflare officially supports Jest integration via Miniflare custom environment

### Migration Approach

- **Progressive**: Phase-by-phase migration, not big-bang
- **Risk-Mitigated**: Run both test frameworks in parallel during transition
- **Rollback-Safe**: Each phase can be independently rolled back via Git branches

---

## Current State Analysis

### Test File Inventory

| Category | Count | Description |
|----------|-------|-------------|
| Unit Tests (Batch 1) | 6 | Utilities, minimal Cloudflare dependencies |
| Unit Tests (Batch 2) | 7 | Repositories (D1 only) |
| Unit Tests (Batch 3) | 16 | Services (multiple bindings, API mocking) |
| Integration Tests | 6 | Full HTTP stack tests |
| Legacy/Frontend Tests | 7 | Low priority, apps/web directory |
| **Total** | **42** | Including legacy tests |

### Current Dependencies

```json
{
  "vitest": "^3.2.4",
  "@vitest/coverage-v8": "^3.2.4",
  "@cloudflare/vitest-pool-workers": "^0.11.1"
}
```

### Cloudflare Bindings Used

1. **D1 Database** (`env.DB`) - All repository and integration tests
2. **R2 Bucket** (`env.R2_BUCKET`) - File upload/download tests
3. **Vectorize Index** (`env.VECTORIZE_INDEX`) - Embedding/RAG tests
4. **AI Gateway** (`env.AI`) - OpenAI API tests
5. **Queue** (`env.EMBEDDING_QUEUE`) - Async processing tests

### Test Setup Pattern (Current)

```typescript
// tests/setup.ts (Vitest)
import { env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  const db = (env as unknown as Env).DB;
  await applyMigrationsOrFallback(db);
});
```

```typescript
// Individual test file (Vitest)
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

const testEnv = env as unknown as Env;

describe('SomeRepository', () => {
  beforeEach(async () => {
    await testEnv.DB.prepare('DELETE FROM table').run();
  });

  it('should do something', async () => {
    // Test with testEnv.DB
  });
});
```

---

## Migration Phases

### Phase 1: Environment Setup (3-4 hours)

**Goal**: Establish Jest + Miniflare parallel execution environment

**Tasks**:
1. Install Jest dependencies
2. Create Jest configuration with Miniflare environment
3. Create Jest setup files mimicking current Vitest setup
4. Configure parallel test execution (npm scripts)
5. Verify empty Jest test suite runs

**Deliverables**:
- `jest.config.ts` with Miniflare integration
- `tests/jest-global-setup.ts` for global Miniflare initialization
- `tests/jest-global-teardown.ts` for cleanup
- `tests/jest-setup.ts` with D1 migrations (per-suite setup)
- `tests/jest-helpers.ts` for binding access utilities
- Updated `package.json` scripts
- Documentation for running both frameworks

**Success Criteria**:
- `npm run test:jest` runs successfully (even with 0 tests)
- `npm run test:vitest` continues to work
- `npm run test:all` runs both in parallel

**Dependencies to Install**:
```bash
npm install -D \
  jest \
  @types/jest \
  miniflare \
  @miniflare/d1 \
  @miniflare/r2 \
  @miniflare/storage-memory
```

**Configuration Example** (jest.config.ts):
```typescript
import type { Config } from 'jest';
import { createMiniflareTester } from './tests/miniflare-tester';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/jest-global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.ts'],
  testMatch: [
    '**/tests/**/*.jest.test.ts', // Initially target renamed files
  ],
  moduleNameMapper: {
    '^@worker/(.*)$': '<rootDir>/apps/worker/src/$1',
    '^@web/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1',
  },
};

export default config;
```

---

### Phase 2: Unit Tests Migration - Batch 1 (4-6 hours)

**Goal**: Migrate 6 utility test files with minimal Cloudflare dependencies

**Target Files**:
1. `tests/unit/chunking.test.ts` - Pure utility, no bindings
2. `tests/unit/date-utils.test.ts` - Pure utility, no bindings
3. `tests/unit/errors.test.ts` - Pure utility, no bindings
4. `tests/unit/schemas.test.ts` - Zod validation, no bindings
5. `tests/unit/text-format.test.ts` - Pure utility, no bindings
6. `tests/unit/validation.test.ts` - Middleware validation, minimal bindings

**Migration Steps per File**:
1. Copy `*.test.ts` → `*.jest.test.ts`
2. Replace `import { describe, it, expect, beforeEach, vi } from 'vitest'`
   → `import { describe, it, expect, beforeEach, jest } from '@jest/globals'`
3. Replace `vi.fn()` → `jest.fn()`
4. Replace `vi.spyOn()` → `jest.spyOn()`
5. Remove `import { env } from 'cloudflare:test'` if unused
6. Run Jest test, fix any incompatibilities
7. Verify both Vitest and Jest pass
8. Delete `.jest.test.ts` suffix, update Jest config to include `*.test.ts`
9. Delete original Vitest file when confident

**Validation**:
- All 6 files pass in Jest
- Original Vitest tests still pass (before deletion)
- No regression in test coverage

**Rollback Plan**:
- Git branch: `migrate/phase2-batch1`
- Keep Vitest files until phase completion verified

---

### Phase 3: Unit Tests Migration - Batch 2 (6-8 hours)

**Goal**: Migrate 7 repository tests (D1 binding only)

**Target Files**:
1. `tests/unit/department-repository.test.ts`
2. `tests/unit/embedding-retry-queue-repository.test.ts`
3. `tests/unit/person-repository.test.ts`
4. `tests/unit/project-repository.test.ts`
5. `tests/unit/statistics-repository.test.ts`
6. `tests/unit/todo-repository.test.ts`
7. `tests/unit/work-note-repository.test.ts`

**Key Challenge**: Replace `import { env } from 'cloudflare:test'` with Miniflare D1 binding

**Migration Pattern**:

```typescript
// Before (Vitest)
import { env } from 'cloudflare:test';
const testEnv = env as unknown as Env;

describe('SomeRepository', () => {
  it('should query DB', async () => {
    const repo = new SomeRepository(testEnv.DB);
    // ...
  });
});
```

```typescript
// After (Jest + Miniflare)
import { getMiniflareBindings } from '../jest-helpers';

describe('SomeRepository', () => {
  let db: D1Database;

  beforeAll(async () => {
    const bindings = await getMiniflareBindings();
    db = bindings.DB;
  });

  it('should query DB', async () => {
    const repo = new SomeRepository(db);
    // ...
  });
});
```

**Helper to Create** (`tests/jest-helpers.ts`):
```typescript
import { Miniflare } from 'miniflare';

// Store Miniflare instance in global scope to avoid singleton state sharing
declare global {
  var __miniflare: Miniflare | undefined;
}

export async function getMiniflareBindings() {
  // Create new instance per test suite via beforeAll/afterAll
  // Do NOT use singleton pattern to prevent state leakage between tests
  if (!global.__miniflare) {
    global.__miniflare = new Miniflare({
      modules: true,
      script: '',
      d1Databases: { DB: 'worknote-db' },
      d1Persist: false,
    });
  }

  return {
    DB: await global.__miniflare.getD1Database('DB'),
    // Add other bindings as needed
  };
}

export async function disposeMiniflare() {
  if (global.__miniflare) {
    await global.__miniflare.dispose();
    global.__miniflare = undefined;
  }
}

// Usage in test files:
// describe('SomeTest', () => {
//   beforeAll(async () => {
//     await getMiniflareBindings();
//   });
//
//   afterAll(async () => {
//     await disposeMiniflare();
//   });
// });
```

**Validation**:
- All 7 repository tests pass in Jest
- Database migrations apply correctly
- beforeEach cleanup works as expected

**Rollback Plan**:
- Git branch: `migrate/phase3-batch2`

---

### Phase 4: Unit Tests Migration - Batch 3 (10-14 hours)

**Goal**: Migrate 16 service-layer tests (complex bindings, mocking)

**Target Files**:
1. `tests/unit/ai-draft-service.test.ts` - AI Gateway binding + mocks
2. `tests/unit/api-departments.test.ts`
3. `tests/unit/auth.test.ts` - Header mocking
4. `tests/unit/embedding-service.test.ts` - Vectorize + OpenAI mocks
5. `tests/unit/fts-search-service.test.ts`
6. `tests/unit/group-recurring-todos.test.ts`
7. `tests/unit/hybrid-search-service.test.ts`
8. `tests/unit/migration-project-management.test.ts`
9. `tests/unit/pdf-extraction-service.test.ts` - unpdf mocking
10. `tests/unit/pdf-job-repository.test.ts`
11. `tests/unit/project-file-service.test.ts` - R2 binding
12. `tests/unit/rag-service.project.test.ts` - Vectorize binding
13. `tests/unit/todo-grouping.test.ts`
14. `tests/unit/work-note-file-service.test.ts` - R2 binding
15. `tests/unit/work-note-file-utils.test.ts`
16. `tests/unit/work-note-service.test.ts` - Queue binding

**Key Challenges**:
- Mock R2 bucket operations
- Mock Vectorize index
- Mock AI Gateway
- Mock Queue bindings
- Replace `vi.fn()` with `jest.fn()` extensively

**R2 Mock Pattern**:
```typescript
// Before (Vitest)
class MockR2 implements R2Bucket {
  storage = new Map();
  async put(key, value) { /* ... */ }
  async get(key) { /* ... */ }
}

testEnv.R2_BUCKET = new MockR2() as unknown as R2Bucket;
```

```typescript
// After (Jest)
import { getMiniflareBindings } from '../jest-helpers';

// Option 1: Use Miniflare's real R2 simulation
const bindings = await getMiniflareBindings();
const r2 = bindings.R2_BUCKET; // Real Miniflare R2

// Option 2: Continue using mock if needed
class MockR2 implements R2Bucket {
  // Same implementation
}
const r2 = new MockR2();
```

**Validation**:
- All 16 service tests pass
- External API mocks work correctly (global.fetch)
- No binding-related failures

**Rollback Plan**:
- Git branch: `migrate/phase4-batch3`

---

### Phase 5: Integration Tests Migration (8-10 hours)

**Goal**: Migrate 6 HTTP integration tests

**Target Files**:
1. `tests/integration/admin-embedding-failures.test.ts`
2. `tests/integration/project-files.test.ts`
3. `tests/integration/project-routes.test.ts`
4. `tests/integration/statistics-routes.test.ts`
5. `tests/integration/work-note-file-view.test.ts`
6. `tests/integration/work-note-project-association.test.ts`

**Key Challenge**: Replace `SELF.fetch()` with Miniflare worker invocation

**Migration Pattern**:

```typescript
// Before (Vitest)
import { SELF } from 'cloudflare:test';

const authFetch = (url: string, options?: RequestInit) =>
  SELF.fetch(url, {
    ...options,
    headers: {
      'Cf-Access-Authenticated-User-Email': 'test@example.com',
      ...options?.headers,
    },
  });

it('should return 200', async () => {
  const res = await authFetch('http://localhost/api/work-notes');
  expect(res.status).toBe(200);
});
```

```typescript
// After (Jest + Miniflare)
import { Miniflare } from 'miniflare';
import workerScript from '../../apps/worker/src/index'; // May need build step

let miniflare: Miniflare;

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    scriptPath: './apps/worker/src/index.ts', // Or built bundle
    d1Databases: { DB: 'worknote-db' },
    r2Buckets: { R2_BUCKET: 'test-bucket' },
    bindings: {
      ENVIRONMENT: 'test',
    },
  });
});

// IMPORTANT: Clean up after each test suite to prevent state leakage
afterAll(async () => {
  if (miniflare) {
    await miniflare.dispose();
  }
});

const authFetch = async (path: string, options?: RequestInit) => {
  return miniflare.dispatchFetch(`http://localhost${path}`, {
    ...options,
    headers: {
      'Cf-Access-Authenticated-User-Email': 'test@example.com',
      ...options?.headers,
    },
  });
};

it('should return 200', async () => {
  const res = await authFetch('/api/work-notes');
  expect(res.status).toBe(200);
});
```

**Build Consideration**:
- May need to compile worker TypeScript to JavaScript before testing
- Or use `esbuild` / `wrangler build` in Jest setup

**Validation**:
- All integration tests pass
- HTTP routing works correctly
- Auth headers propagate correctly

**Rollback Plan**:
- Git branch: `migrate/phase5-integration`

---

### Phase 6: Cleanup & Vitest Removal (2-3 hours)

**Goal**: Remove Vitest dependencies and finalize Jest migration

**Tasks**:
1. Delete all Vitest-specific files
   - `vitest.config.ts`
   - `tests/setup.ts` (Vitest version)
2. Remove Vitest dependencies from package.json
   ```bash
   npm uninstall vitest @vitest/coverage-v8 @cloudflare/vitest-pool-workers
   ```
3. Update npm scripts
   ```json
   {
     "test": "jest",
     "test:coverage": "jest --coverage",
     "test:watch": "jest --watch"
   }
   ```
4. Update CI/CD pipelines (if any)
5. Update documentation
   - README.md test instructions
   - CONTRIBUTING.md (if exists)
6. Final validation run
   ```bash
   npm test
   npm run test:coverage
   ```
7. Update `.governance/memory.md` with migration summary

**Validation**:
- All 614+ tests pass in Jest
- No Vitest references in codebase
- CI/CD pipelines work with Jest
- Documentation updated

**Rollback Plan**:
- Git branch: `migrate/phase6-cleanup`
- Can restore Vitest from git history if needed

---

## Risk Management

### High-Risk Areas

| Risk | Mitigation |
|------|------------|
| **Binding incompatibility** | Use Miniflare's official bindings, test extensively |
| **Test behavior changes** | Run both frameworks in parallel until confident |
| **CI/CD breakage** | Update CI config after local validation |
| **Coverage loss** | Compare coverage reports before/after |

### Rollback Strategy

Each phase uses a dedicated Git branch:
- `migrate/phase1-setup`
- `migrate/phase2-batch1`
- `migrate/phase3-batch2`
- `migrate/phase4-batch3`
- `migrate/phase5-integration`
- `migrate/phase6-cleanup`

**Rollback Command**:
```bash
git checkout main
git branch -D migrate/phase{N}
```

---

## Parallel Execution During Migration

### npm Scripts Configuration

```json
{
  "scripts": {
    "test": "npm run test:all",
    "test:all": "concurrently \"npm:test:vitest\" \"npm:test:jest\"",
    "test:vitest": "vitest --run",
    "test:jest": "jest",
    "test:coverage": "jest --coverage"
  }
}
```

### Phased Test Pattern Switching

- **Phase 1-2**: `*.jest.test.ts` for Jest, `*.test.ts` for Vitest
- **Phase 3-4**: Gradually convert `*.test.ts` to Jest, remove Vitest files
- **Phase 5-6**: Jest only

---

## Timeline Estimation

| Phase | Estimated Time | Risk Level |
|-------|----------------|------------|
| Phase 1: Setup | 3-4 hours | Low |
| Phase 2: Batch 1 (Utilities) | 4-6 hours | Low |
| Phase 3: Batch 2 (Repositories) | 6-8 hours | Medium |
| Phase 4: Batch 3 (Services) | 10-14 hours | High |
| Phase 5: Integration Tests | 8-10 hours | High |
| Phase 6: Cleanup | 2-3 hours | Low |
| **Total** | **33-45 hours** | |

**Recommendation**: Plan 1-2 weeks with daily progress checkpoints.

---

## Success Criteria

### Per-Phase Criteria

- [ ] All tests in current phase pass in Jest
- [ ] No regression in Vitest (before deletion)
- [ ] Code coverage maintained or improved
- [ ] Documentation updated for phase

### Overall Migration Success

- [ ] All 614+ tests pass in Jest
- [ ] Zero Vitest dependencies in package.json
- [ ] CI/CD pipelines working with Jest
- [ ] Developer documentation updated
- [ ] `.governance/memory.md` updated with migration learnings

---

## Post-Migration Optimizations

After successful migration, consider:

1. **Coverage Improvements**: Jest coverage works better than Vitest in Workers environment
2. **Test Performance**: Benchmark Jest vs. Vitest execution time
3. **Watch Mode**: Configure Jest watch mode for development
4. **Snapshot Testing**: Leverage Jest's snapshot capabilities
5. **Parallel Execution**: Configure Jest's `maxWorkers` for faster CI

---

## References

- [Cloudflare Workers Testing Documentation](https://developers.cloudflare.com/workers/testing/)
- [Miniflare Documentation](https://miniflare.dev/)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Migrating from Vitest to Jest](https://jestjs.io/docs/migration-guide)

---

**Next Steps**: Proceed to TASK-MIGRATE-001 (Phase 1 setup) upon approval.
