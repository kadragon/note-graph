// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-TYPE-SAFE-MOCKS
/**
 * Type-safe mock builders for test files
 *
 * This module provides type-safe alternatives to `jest.fn<any>()` and `as any` casts.
 * Use these helpers to create properly typed mocks for Cloudflare Workers bindings
 * and common service interfaces.
 */

import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  R2Bucket,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
  VectorizeIndex,
  VectorizeMatches,
  VectorizeVector,
} from '@cloudflare/workers-types';
import { jest } from '@jest/globals';

// =============================================================================
// D1Database Mock Helpers
// =============================================================================

/**
 * Type-safe D1PreparedStatement mock builder
 */
export interface MockD1PreparedStatement {
  bind: jest.Mock<(...values: unknown[]) => MockD1PreparedStatement>;
  run: jest.Mock<() => Promise<D1Result>>;
  first: jest.Mock<(colName?: string) => Promise<unknown>>;
  all: jest.Mock<() => Promise<D1Result>>;
}

/**
 * Type-safe D1Database mock builder
 */
export interface MockD1Database {
  prepare: jest.Mock<(query: string) => MockD1PreparedStatement>;
  batch: jest.Mock<(statements: any[]) => Promise<D1Result[]>>;
  exec: jest.Mock<(query: string) => Promise<D1Result>>;
}

/**
 * Creates a type-safe D1Database mock with common defaults
 */
export function createMockD1Database(overrides?: Partial<MockD1Database>): MockD1Database {
  const mockStatement: MockD1PreparedStatement = {
    bind: jest.fn<(...values: unknown[]) => MockD1PreparedStatement>().mockReturnThis(),
    run: jest.fn<() => Promise<D1Result>>().mockResolvedValue({
      success: true,
      meta: {} as any,
      results: [],
    }),
    first: jest.fn<(colName?: string) => Promise<unknown>>().mockResolvedValue(null),
    all: jest.fn<() => Promise<D1Result>>().mockResolvedValue({
      success: true,
      meta: {} as any,
      results: [],
    }),
  };

  const mockDb: MockD1Database = {
    prepare: jest.fn<(query: string) => MockD1PreparedStatement>().mockReturnValue(mockStatement),
    batch: jest
      .fn<(statements: any[]) => Promise<D1Result[]>>()
      .mockResolvedValue([{ success: true, meta: {} as any, results: [] }]),
    exec: jest.fn<(query: string) => Promise<D1Result>>().mockResolvedValue({
      success: true,
      meta: {} as any,
      results: [],
    }),
    ...overrides,
  };

  return mockDb;
}

// =============================================================================
// R2Bucket Mock Helpers
// =============================================================================

/**
 * Type-safe R2Bucket mock builder
 */
export interface MockR2Bucket {
  get: jest.Mock<(key: string) => Promise<R2ObjectBody | null>>;
  put: jest.Mock<
    (
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
      options?: R2PutOptions
    ) => Promise<R2Object | null>
  >;
  delete: jest.Mock<(keys: string | string[]) => Promise<void>>;
  head: jest.Mock<(key: string) => Promise<R2Object | null>>;
  list: jest.Mock<(options?: any) => Promise<any>>;
}

/**
 * Simple in-memory R2Bucket mock with storage
 */
export class InMemoryR2Bucket {
  storage = new Map<
    string,
    { value: Blob; httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
  >();

  get = jest.fn<(key: string) => Promise<R2ObjectBody | null>>(async (key: string) => {
    const entry = this.storage.get(key);
    if (!entry) return null;

    return {
      body: entry.value.stream(),
      size: entry.value.size,
      writeHttpMetadata: () => {},
      httpEtag: '',
      httpMetadata: entry.httpMetadata ?? {},
      customMetadata: entry.customMetadata ?? {},
    } as unknown as R2ObjectBody;
  });

  put = jest.fn<
    (
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
      options?: R2PutOptions
    ) => Promise<R2Object | null>
  >(async (key: string, value: any, options?: R2PutOptions) => {
    const blob = value instanceof Blob ? value : new Blob([value]);
    this.storage.set(key, {
      value: blob,
      httpMetadata: options?.httpMetadata as Record<string, string>,
      customMetadata: options?.customMetadata,
    });
    return null;
  });

  delete = jest.fn<(keys: string | string[]) => Promise<void>>(async (keys: string | string[]) => {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    keyArray.forEach((key) => this.storage.delete(key));
  });

  head = jest.fn<(key: string) => Promise<R2Object | null>>().mockResolvedValue(null);

  list = jest.fn<(options?: any) => Promise<any>>().mockResolvedValue({
    objects: [],
    truncated: false,
  });

  createMultipartUpload = jest.fn<any>().mockResolvedValue(null);
  resumeMultipartUpload = jest.fn<any>().mockResolvedValue(null);
}

/**
 * Creates a simple mock R2Bucket without storage
 */
export function createMockR2Bucket(overrides?: Partial<MockR2Bucket>): MockR2Bucket {
  return {
    get: jest.fn<(key: string) => Promise<R2ObjectBody | null>>().mockResolvedValue(null),
    put: jest
      .fn<(key: string, value: any, options?: R2PutOptions) => Promise<R2Object | null>>()
      .mockResolvedValue(null),
    delete: jest.fn<(keys: string | string[]) => Promise<void>>().mockResolvedValue(undefined),
    head: jest.fn<(key: string) => Promise<R2Object | null>>().mockResolvedValue(null),
    list: jest
      .fn<(options?: any) => Promise<any>>()
      .mockResolvedValue({ objects: [], truncated: false }),
    ...overrides,
  };
}

// =============================================================================
// Vectorize Mock Helpers
// =============================================================================

/**
 * Type-safe VectorizeIndex mock builder
 */
export interface MockVectorizeIndex {
  upsert: jest.Mock<(vectors: VectorizeVector[]) => Promise<any>>;
  deleteByIds: jest.Mock<(ids: string[]) => Promise<any>>;
  query: jest.Mock<(vector: number[], options?: any) => Promise<VectorizeMatches>>;
  insert: jest.Mock<(vectors: VectorizeVector[]) => Promise<any>>;
  getByIds: jest.Mock<(ids: string[]) => Promise<VectorizeVector[]>>;
}

/**
 * Creates a type-safe VectorizeIndex mock
 */
export function createMockVectorizeIndex(
  overrides?: Partial<MockVectorizeIndex>
): MockVectorizeIndex {
  return {
    upsert: jest.fn<(vectors: VectorizeVector[]) => Promise<any>>().mockResolvedValue(undefined),
    deleteByIds: jest.fn<(ids: string[]) => Promise<any>>().mockResolvedValue(undefined),
    query: jest
      .fn<(vector: number[], options?: any) => Promise<VectorizeMatches>>()
      .mockResolvedValue({
        count: 0,
        matches: [],
      }),
    insert: jest.fn<(vectors: VectorizeVector[]) => Promise<any>>().mockResolvedValue(undefined),
    getByIds: jest.fn<(ids: string[]) => Promise<VectorizeVector[]>>().mockResolvedValue([]),
    ...overrides,
  };
}

// =============================================================================
// Common Service Mock Helpers
// =============================================================================

/**
 * Type-safe mock for embedding services
 */
export interface MockEmbeddingService {
  embed: jest.Mock<(text: string) => Promise<number[]>>;
  embedBatch: jest.Mock<(texts: string[]) => Promise<number[][]>>;
}

/**
 * Creates a mock embedding service with default 1536-dimensional vectors
 */
export function createMockEmbeddingService(
  dimension = 1536,
  overrides?: Partial<MockEmbeddingService>
): MockEmbeddingService {
  const defaultVector = new Array(dimension).fill(0);

  return {
    embed: jest.fn<(text: string) => Promise<number[]>>().mockResolvedValue(defaultVector),
    embedBatch: jest
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockImplementation(async (texts: string[]) => texts.map(() => [...defaultVector])),
    ...overrides,
  };
}

/**
 * Type-safe mock for vectorize service wrapper
 */
export interface MockVectorizeService {
  insert: jest.Mock<(vectors: VectorizeVector[]) => Promise<void>>;
  delete: jest.Mock<(ids: string[]) => Promise<void>>;
  query: jest.Mock<(vector: number[], options?: any) => Promise<VectorizeMatches>>;
}

/**
 * Creates a mock VectorizeService wrapper
 */
export function createMockVectorizeService(
  overrides?: Partial<MockVectorizeService>
): MockVectorizeService {
  return {
    insert: jest.fn<(vectors: VectorizeVector[]) => Promise<void>>().mockResolvedValue(undefined),
    delete: jest.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined),
    query: jest
      .fn<(vector: number[], options?: any) => Promise<VectorizeMatches>>()
      .mockResolvedValue({
        count: 0,
        matches: [],
      }),
    ...overrides,
  };
}

/**
 * Type-safe mock for embedding processor
 */
export interface MockEmbeddingProcessor {
  upsertChunks: jest.Mock<(chunks: any[]) => Promise<void>>;
  deleteChunks: jest.Mock<(ids: string[]) => Promise<void>>;
}

/**
 * Creates a mock embedding processor
 */
export function createMockEmbeddingProcessor(
  overrides?: Partial<MockEmbeddingProcessor>
): MockEmbeddingProcessor {
  return {
    upsertChunks: jest.fn<(chunks: any[]) => Promise<void>>().mockResolvedValue(undefined),
    deleteChunks: jest.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Type-safe mock for text extractors
 */
export interface MockTextExtractor {
  extractText: jest.Mock<(input: any) => Promise<{ success: boolean; text: string }>>;
}

/**
 * Creates a mock text extractor
 */
export function createMockTextExtractor(
  defaultText = 'Extracted text content',
  overrides?: Partial<MockTextExtractor>
): MockTextExtractor {
  return {
    extractText: jest
      .fn<(input: any) => Promise<{ success: boolean; text: string }>>()
      .mockResolvedValue({
        success: true,
        text: defaultText,
      }),
    ...overrides,
  };
}

/**
 * Type-safe mock for fetch API
 */
export type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Creates a type-safe mock fetch function
 */
export function createMockFetch(
  defaultResponse?: any
): jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>> {
  const response = {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    ...defaultResponse,
  };

  return jest
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(response as Response);
}

// =============================================================================
// Type Assertion Helpers
// =============================================================================

/**
 * Type-safe alternative to `as any` for Cloudflare Workers types
 * Use this when you need to cast a mock to the actual type
 */
export function asD1Database(mock: MockD1Database): D1Database {
  return mock as unknown as D1Database;
}

export function asR2Bucket(mock: MockR2Bucket | InMemoryR2Bucket): R2Bucket {
  return mock as unknown as R2Bucket;
}

export function asVectorizeIndex(mock: MockVectorizeIndex): VectorizeIndex {
  return mock as unknown as VectorizeIndex;
}
