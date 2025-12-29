// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-005
// Integration tests for work note file preview route (Jest)

import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import app from '@worker/index';
import type { Env } from '@worker/types/env';

type WritableEnv = {
  -readonly [K in keyof Env]: Env[K];
};

interface GlobalWithTestR2 {
  __TEST_R2_BUCKET: R2Bucket;
}

const createExecutionContext = () => ({
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
});

class MockR2 {
  storage = new Map<
    string,
    {
      value: Blob;
      httpMetadata?: R2HTTPMetadata | Headers;
      customMetadata?: Record<string, string>;
    }
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
      httpMetadata: (entry.httpMetadata ?? {}) as R2HTTPMetadata,
      customMetadata: entry.customMetadata ?? {},
      httpEtag: '',
      writeHttpMetadata: () => {},
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async head(): Promise<R2Object | null> {
    return null;
  }

  async list(): Promise<{ objects: R2Object[] }> {
    return { objects: [] };
  }

  async createMultipartUpload(): Promise<never> {
    throw new Error('Multipart upload not implemented in tests');
  }

  async resumeMultipartUpload(): Promise<never> {
    throw new Error('Multipart upload not implemented in tests');
  }
}

async function createTestEnv(overrides: Partial<Env> = {}): Promise<Env> {
  const db = await globalThis.getDB();
  return {
    DB: db,
    VECTORIZE: {
      query: async () => ({ matches: [] }),
      deleteByIds: async () => undefined,
      upsert: async () => undefined,
    } as unknown as Env['VECTORIZE'],
    AI_GATEWAY: { fetch: async () => new Response('') } as unknown as Env['AI_GATEWAY'],
    ASSETS: { fetch: async () => new Response('') } as unknown as Env['ASSETS'],
    R2_BUCKET: new MockR2() as unknown as R2Bucket,
    ENVIRONMENT: 'production',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    AI_GATEWAY_ID: 'test-gateway',
    OPENAI_MODEL_CHAT: 'gpt-test',
    OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
    OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
    OPENAI_API_KEY: 'test-key',
    ...overrides,
  } as Env;
}

const authFetch = (env: Env, url: string, options?: RequestInit) =>
  app.request(
    url,
    {
      ...options,
      headers: {
        'Cf-Access-Authenticated-User-Email': 'test@example.com',
        ...options?.headers,
      },
    },
    env,
    createExecutionContext()
  );

describe('Work Note File Preview Route', () => {
  let testEnv: WritableEnv;

  beforeEach(async () => {
    testEnv = (await createTestEnv()) as WritableEnv;

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_files'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    // Seed minimal work note
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind('WORK-123', '테스트 업무노트', '내용', now, now)
      .run();

    // Provide mock R2 binding for streaming routes
    testEnv.R2_BUCKET = new MockR2() as unknown as R2Bucket;
    (globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET = testEnv.R2_BUCKET;
  });

  it('serves inline preview for PDF via /view endpoint', async () => {
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch(testEnv, 'http://localhost/api/work-notes/WORK-123/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = (await uploadRes.json()) as { fileId: string };

    // View (inline)
    const viewRes = await authFetch(
      testEnv,
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/view`
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(viewRes.headers.get('Content-Disposition')).toContain('inline;');
    expect(await viewRes.text()).toContain('hello pdf');

    // Download (attachment)
    const downloadRes = await authFetch(
      testEnv,
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/download`
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(downloadRes.headers.get('Content-Disposition')).toContain('attachment;');
    expect(await downloadRes.text()).toContain('hello pdf');
  });
});
