/**
 * Integration test helper: enables route testing with PGlite.
 *
 * Usage in integration test files:
 *
 *   import { vi } from 'vitest';
 *   vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());
 *
 *   import { createTestRequest, createAuthFetch } from '../helpers/test-app';
 *   import worker from '@worker/index';
 *
 *   const request = createTestRequest(worker);
 *   const authFetch = createAuthFetch(worker);
 */

import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import type { Env } from '@worker/types/env';

// ---------------------------------------------------------------------------
// Mock R2 (same as old test-setup.ts)
// ---------------------------------------------------------------------------

export class MockR2 implements R2Bucket {
  storage = new Map<
    string,
    { value: Blob; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> }
  >();

  async put(key: string, value: Blob, options?: R2PutOptions): Promise<R2Object | null> {
    this.storage.set(key, {
      value,
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });
    return null;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    return {
      body: entry.value.stream(),
      size: entry.value.size,
      httpMetadata: entry.httpMetadata ?? {},
      customMetadata: entry.customMetadata ?? {},
      httpEtag: '',
      arrayBuffer: () => entry.value.arrayBuffer(),
      text: () => entry.value.text(),
      json: async () => JSON.parse(await entry.value.text()),
      blob: () => entry.value,
      writeHttpMetadata: () => {},
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async head(): Promise<R2Object | null> {
    return null;
  }
}

// ---------------------------------------------------------------------------
// vi.mock factory for database-factory
// ---------------------------------------------------------------------------

// Shared lazy references for the mock database factory.
// These are populated on first use (during request handling, after beforeAll).
let _dbRef: import('@worker/types/database').DatabaseClient | null = null;
let _ftsRef: import('@worker/types/fts-dialect').FtsDialect | null = null;

function getTestPgDb() {
  if (!_dbRef) {
    // Dynamic import from the pg-setup module (already loaded by setupFiles)
    _dbRef = (globalThis as Record<string, unknown>)
      .__testPgDb as import('@worker/types/database').DatabaseClient;
  }
  return _dbRef;
}

function getTestFtsDialect() {
  if (!_ftsRef) {
    _ftsRef = (globalThis as Record<string, unknown>)
      .__testFtsDialect as import('@worker/types/fts-dialect').FtsDialect;
  }
  return _ftsRef;
}

/**
 * Returns a mock implementation of `@worker/adapters/database-factory`.
 *
 * Must be called inside `vi.mock(...)`:
 *   vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());
 *
 * Lazily resolves testPgDb via globalThis (set by pg-setup.ts).
 */
export function mockDatabaseFactory() {
  return {
    createDatabaseClient: () => getTestPgDb(),
    createFtsDialect: () => getTestFtsDialect(),
  };
}

// ---------------------------------------------------------------------------
// Mock Env
// ---------------------------------------------------------------------------

const defaultMockR2 = new MockR2();

function createMockHyperdrive(): Hyperdrive {
  return {
    connectionString: 'postgresql://user:pass@host:5432/note_graph_test',
    host: 'host',
    port: 5432,
    user: 'user',
    password: 'pass',
    database: 'note_graph_test',
  } as unknown as Hyperdrive;
}

export function buildMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    HYPERDRIVE: createMockHyperdrive(),
    VECTORIZE: {} as unknown as VectorizeIndex,
    AI_GATEWAY: {} as unknown as Fetcher,
    ASSETS: {
      fetch: async () => new Response('', { status: 404 }),
    } as unknown as Fetcher,
    R2_BUCKET: defaultMockR2 as unknown as R2Bucket,
    ENVIRONMENT: 'production',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    AI_GATEWAY_ID: 'test-gateway-id',
    OPENAI_MODEL_CHAT: 'gpt-4.5-turbo',
    OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
    OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
    OPENAI_API_KEY: 'test-openai-key',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
    GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    CLOUDFLARE_API_TOKEN: 'test-cloudflare-api-token',
    ...overrides,
  } as Env;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

interface WorkerModule {
  default: {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
  };
}

function makeExecutionContext(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

/**
 * Create a request function that calls the worker's fetch handler with mock env.
 */
export function createTestRequest(
  worker: WorkerModule['default'],
  envOverrides: Partial<Env> = {}
) {
  const env = buildMockEnv(envOverrides);
  const ctx = makeExecutionContext();

  const request = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, 'http://localhost').href;
    const req = new Request(url, init);
    return worker.fetch(req, env, ctx);
  };

  return Object.assign(request, { env });
}

/**
 * Create an authenticated fetch helper.
 * Adds Cloudflare Access email header automatically.
 */
export function createAuthFetch(worker: WorkerModule['default'], envOverrides: Partial<Env> = {}) {
  const env = buildMockEnv(envOverrides);
  const ctx = makeExecutionContext();

  return (input: string, options: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost').href;
    const headers = new Headers(options.headers);
    if (!headers.has('Cf-Access-Authenticated-User-Email')) {
      headers.set('Cf-Access-Authenticated-User-Email', 'test@example.com');
    }
    const body = options.body;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const req = new Request(url, { ...options, headers });
    return worker.fetch(req, env, ctx);
  };
}
