# Test Mock Helpers

Type-safe mock builders for Cloudflare Workers bindings and common service interfaces.

## Purpose

This module provides type-safe alternatives to `jest.fn<any>()` and `as any` casts in test files. Use these helpers to create properly typed mocks that reduce the usage of `any` throughout your test suite.

## Available Helpers

### D1Database Mocks

#### `createMockD1Database(overrides?)`

Creates a type-safe D1Database mock with common defaults.

```typescript
import { createMockD1Database, asD1Database } from '@test-helpers/mock-helpers';

const mockDb = createMockD1Database();

// Use with services that need D1Database
const service = new MyService(asD1Database(mockDb));

// Customize behavior
mockDb.prepare('SELECT * FROM users').all.mockResolvedValue({
  success: true,
  meta: {} as any,
  results: [{ id: 1, name: 'John' }],
});
```

### R2Bucket Mocks

#### `InMemoryR2Bucket`

A full in-memory R2Bucket implementation with storage.

```typescript
import { InMemoryR2Bucket, asR2Bucket } from '@test-helpers/mock-helpers';

const r2 = new InMemoryR2Bucket();

// Use with services
const service = new ProjectFileService(env, asR2Bucket(r2), db);

// Access storage directly
r2.storage.set('key', { value: new Blob(['test']) });
expect(r2.storage.has('key')).toBe(true);
```

#### `createMockR2Bucket(overrides?)`

Creates a simple mock R2Bucket without storage.

```typescript
import { createMockR2Bucket, asR2Bucket } from '@test-helpers/mock-helpers';

const mockR2 = createMockR2Bucket({
  get: jest.fn().mockResolvedValue(null),
});
```

### Vectorize Mocks

#### `createMockVectorizeIndex(overrides?)`

Creates a type-safe VectorizeIndex mock.

```typescript
import { createMockVectorizeIndex, asVectorizeIndex } from '@test-helpers/mock-helpers';

const mockVectorize = createMockVectorizeIndex({
  query: jest.fn().mockResolvedValue({
    count: 2,
    matches: [
      { id: 'vec1', score: 0.95 },
      { id: 'vec2', score: 0.85 },
    ],
  }),
});

const env = {
  VECTORIZE: asVectorizeIndex(mockVectorize),
} as Env;
```

### Service Mocks

#### `createMockEmbeddingService(dimension?, overrides?)`

Creates a mock embedding service with default 1536-dimensional vectors.

```typescript
import { createMockEmbeddingService } from '@test-helpers/mock-helpers';

const mockEmbedding = createMockEmbeddingService();

// Returns mock vectors
await mockEmbedding.embed('test text'); // [0, 0, 0, ...]
await mockEmbedding.embedBatch(['text1', 'text2']); // [[0, 0, ...], [0, 0, ...]]
```

#### `createMockVectorizeService(overrides?)`

Creates a mock VectorizeService wrapper.

```typescript
import { createMockVectorizeService } from '@test-helpers/mock-helpers';

const mockVectorize = createMockVectorizeService();

// Override behavior
mockVectorize.query.mockResolvedValue({
  count: 1,
  matches: [{ id: 'test', score: 0.9 }],
});
```

#### `createMockEmbeddingProcessor(overrides?)`

Creates a mock embedding processor.

```typescript
import { createMockEmbeddingProcessor } from '@test-helpers/mock-helpers';

const mockProcessor = createMockEmbeddingProcessor();

// Verify calls
expect(mockProcessor.upsertChunks).toHaveBeenCalledWith(chunks);
```

#### `createMockTextExtractor(defaultText?, overrides?)`

Creates a mock text extractor.

```typescript
import { createMockTextExtractor } from '@test-helpers/mock-helpers';

const mockExtractor = createMockTextExtractor('Extracted content');

const result = await mockExtractor.extractText(file);
expect(result.text).toBe('Extracted content');
```

### Fetch Mocks

#### `createMockFetch(defaultResponse?)`

Creates a type-safe mock fetch function.

```typescript
import { createMockFetch } from '@test-helpers/mock-helpers';

global.fetch = createMockFetch({
  ok: true,
  json: async () => ({ data: 'response' }),
}) as any;
```

## Usage Examples

### Before: Using `any` everywhere

```typescript
let mockVectorize: {
  insert: jest.Mock<any>;
  delete: jest.Mock<any>;
  query: jest.Mock<any>;
};

beforeEach(() => {
  mockVectorize = {
    insert: jest.fn<any>().mockResolvedValue(undefined),
    delete: jest.fn<any>().mockResolvedValue(undefined),
    query: jest.fn<any>().mockResolvedValue({ matches: [] }),
  };

  const service = new VectorizeService(mockVectorize as any);
});
```

### After: Using type-safe helpers

```typescript
import {
  createMockVectorizeIndex,
  asVectorizeIndex,
  type MockVectorizeIndex,
} from '@test-helpers/mock-helpers';

let mockVectorize: MockVectorizeIndex;

beforeEach(() => {
  mockVectorize = createMockVectorizeIndex();
  const service = new VectorizeService(asVectorizeIndex(mockVectorize));
});
```

## Type Assertion Helpers

When you need to pass a mock to code expecting the actual Cloudflare type, use these helpers:

- `asD1Database(mock)` - Cast MockD1Database to D1Database
- `asR2Bucket(mock)` - Cast MockR2Bucket to R2Bucket
- `asVectorizeIndex(mock)` - Cast MockVectorizeIndex to VectorizeIndex

These provide a single point of `as unknown as Type` casting instead of sprinkling `as any` throughout your tests.

## Benefits

1. **Type Safety**: Catch type errors at compile time instead of runtime
2. **IDE Support**: Get autocomplete and type hints for mock methods
3. **Maintainability**: Changes to Cloudflare types surface as compile errors
4. **Readability**: Clear intent with named functions instead of inline `jest.fn<any>()`
5. **Consistency**: Standardized mock creation across all test files

## Migration Guide

When updating existing tests:

1. Import the relevant helpers from `@test-helpers/mock-helpers`
2. Replace `jest.fn<any>()` with the appropriate typed helper
3. Replace `as any` casts with the `as*` helper functions
4. Update type annotations to use the exported `Mock*` interfaces

## Contributing

When adding new mock helpers:

1. Create typed interfaces that mirror the original types
2. Provide builder functions with sensible defaults
3. Export type assertion helpers for casting
4. Add usage examples to this README
