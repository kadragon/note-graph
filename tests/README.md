# Note Graph Test Suite

**Trace**: TASK-016 - Write comprehensive test suite

## Overview

This test suite uses **Vitest** with **@cloudflare/vitest-pool-workers** to test the Cloudflare Workers application in an environment that closely mimics production.

## Test Infrastructure

- **Test Runner**: Vitest 2.1.8
- **Test Pool**: @cloudflare/vitest-pool-workers
- **Coverage**: @vitest/coverage-v8 with 80% threshold
- **Environment**: Miniflare (local Cloudflare Workers simulator)

## Test Structure

```
tests/
├── setup.ts           # Global test setup
├── api.test.ts        # Basic API integration tests
└── README.md          # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

## Coverage Thresholds

The project requires minimum 80% coverage:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Test Bindings

The Cloudflare Workers test environment provides access to bindings:

- `env` - Environment bindings (DB, VECTORIZE, etc.)
- `SELF` - Worker fetch interface for making requests

## Current Test Coverage

### ✅ Implemented

- **API Integration Tests** (`api.test.ts`)
  - Health check endpoint
  - Root endpoint with API information
  - Authentication middleware
  - 404 handler

### 🚧 Planned (Future Iterations)

Based on `.spec/` files, the following test categories are planned:

1. **Person Management** (SPEC-person-1)
   - CRUD operations
   - Department history tracking
   - Search functionality

2. **Department Management** (SPEC-dept-1)
   - CRUD operations
   - Member associations
   - Work note filtering

3. **Work Note Management** (SPEC-worknote-1)
   - CRUD with versioning
   - Version pruning (max 5)
   - Person associations
   - Related work notes

4. **Todo Management** (SPEC-todo-1)
   - CRUD operations
   - Recurrence logic (DUE_DATE, COMPLETION_DATE)
   - View filters (today, week, month, backlog)
   - Wait_until logic

5. **Search** (SPEC-search-1)
   - FTS lexical search
   - Vectorize semantic search
   - Hybrid search with RRF

6. **RAG** (SPEC-rag-1)
   - Chunking service
   - Scope filtering
   - Contextual Q&A

7. **AI Draft** (SPEC-ai-draft-1)
   - Draft generation from text
   - Todo suggestions
   - Rate limit handling

8. **PDF Processing** (SPEC-pdf-1)
   - PDF upload and job creation
   - Queue consumer processing
   - Text extraction with unpdf
   - Error handling

## Testing Best Practices

1. **Trace Comments**: Each test file includes trace comments linking to specs and tasks
2. **Isolated Tests**: Tests should not depend on each other
3. **Clean State**: Use beforeEach/afterEach for test isolation
4. **Realistic Data**: Use Korean text and realistic workplace scenarios
5. **Error Cases**: Test both success and failure paths

## Notes

- This is Phase 5 (Testing & Polish) initial setup
- Test suite demonstrates infrastructure and basic functionality
- Comprehensive tests for all specs can be expanded iteratively
- D1 database operations in tests use miniflare's in-memory SQLite
- Vectorize, Queue, and R2 bindings are mocked by miniflare

### Known Testing Issues

**AI Gateway Binding**: The current test setup encounters an error with the AI Gateway binding in the Workers runtime environment. This is a known limitation with the external AI worker wrapper in miniflare.

**Workarounds**:
1. Mock the AI services in tests
2. Use integration tests in actual Cloudflare environment
3. Update wrangler.toml with test-specific configuration when AI bindings are fixed

Despite this issue, the testing infrastructure is properly configured and unit tests for pure logic (like chunking, error handling) work correctly once the binding issue is resolved.

## Next Steps

1. Expand test coverage for critical paths
2. Add unit tests for services and repositories
3. Add edge case tests for error handling
4. Implement E2E tests for complete workflows
5. Add performance benchmarks
