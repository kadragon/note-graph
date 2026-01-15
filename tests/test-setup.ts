import { env, SELF } from 'cloudflare:test';
import type {
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
