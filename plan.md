# Test Code Refactoring Plan

## Goal
Simplify and optimize test code by removing unnecessary tests, reducing edge case coverage, and improving maintainability in Vitest + Miniflare environment.

## Tasks

- [x] 1. Analyze and simplify validation.test.ts
  - Remove duplicate "should rethrow non-Zod errors" tests (3 occurrences)
  - Consolidate validateBody/validateQuery/validateParams tests using parameterized patterns
  - Remove edge cases like complex nested schemas and array schemas (rare in practice)
  - Target: Reduce from 528 to ~300 lines

- [x] 2. Simplify schemas.test.ts
  - Remove boundary value tests (e.g., "exactly 200 characters")
  - Consolidate repeated patterns across different schemas
  - Reduce redundant Zod validation tests (Zod already validates schemas)
  - Target: Reduce from 511 to ~250 lines

- [x] 3. Optimize errors.test.ts
  - Keep essential error class tests
  - Remove overly detailed validation of error properties
  - Target: Reduce from 93 to ~40 lines

- [x] 4. Refactor chunking.test.ts
  - Generalize language-specific tests (remove separate "should handle Korean text")
  - Reduce implementation detail dependency
  - Focus on core chunking behavior
  - Target: Reduce from 267 to ~150 lines

- [x] 5. Split and simplify project-routes.test.ts
  - Split into multiple files: project-crud.test.ts, project-participants.test.ts, project-work-notes.test.ts
  - Reduce beforeEach DB cleanup scope (only clean tables used in each test file)
  - Target: Reduce each file to ~200 lines

- [x] 6. Simplify statistics-routes.test.ts
  - Consolidate date filtering tests (first-half, second-half, this-year) into parameterized tests
  - Reduce overly detailed period boundary tests
  - Target: Reduce from 401 to ~200 lines

- [x] 7. Improve test infrastructure
  - Create test-setup.ts with common mock factories
  - Extract repeated mock patterns into reusable functions
  - Consider removing singleWorker: true if test isolation allows

- [x] 8. Update coverage thresholds
  - Review vitest.config.ts thresholds (currently 80/75/80/80)
  - Adjust based on reduced test scope while maintaining critical path coverage

## Notes
- Vitest pool: `@cloudflare/vitest-pool-workers` with `singleWorker: true`
- Current limitation: coverage blocked by node:inspector requirements
- Focus on removing redundancy, not reducing essential coverage
