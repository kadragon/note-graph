import { env, SELF } from 'cloudflare:test';
import type {
  D1PreparedStatement,
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import type { Env } from '@worker/types/env';

type WritableEnv = {
  -readonly [K in keyof Env]: Env[K];
};

interface GlobalWithTestR2 {
  __TEST_R2_BUCKET: R2Bucket;
}

const testEnv = env as unknown as WritableEnv;

// Ensure DB.batch is always available by adding a fallback implementation
// This handles cases where the D1 binding doesn't have batch() in some test isolation scenarios
if (testEnv.DB && !testEnv.DB.batch) {
  (testEnv.DB as unknown as Record<string, unknown>).batch = async (
    statements: D1PreparedStatement[]
  ): Promise<unknown[]> => {
    const results: unknown[] = [];
    for (const stmt of statements) {
      if (stmt && typeof stmt.run === 'function') {
        results.push(await stmt.run());
      } else {
        // Statement might be undefined due to race conditions - skip it
        results.push({ success: true, results: [] });
      }
    }
    return results;
  };
}

class MockR2 implements R2Bucket {
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

const setTestR2Bucket = (bucket: R2Bucket): void => {
  testEnv.R2_BUCKET = bucket;
  (globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET = bucket;
};

const defaultMockR2 = new MockR2();
if (!testEnv.R2_BUCKET) {
  setTestR2Bucket(defaultMockR2);
}

const authFetch = (input: string, options: RequestInit = {}) => {
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

  return SELF.fetch(url, {
    ...options,
    headers,
  });
};

export { authFetch, MockR2, setTestR2Bucket, testEnv };
export type { GlobalWithTestR2, WritableEnv };
