// Trace: SPEC-worknote-attachments-1, TASK-066
// Integration tests for work note file preview route

import { env, SELF } from 'cloudflare:test';
import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

type WritableEnv = {
  -readonly [K in keyof Env]: Env[K];
};

interface GlobalWithTestR2 {
  __TEST_R2_BUCKET: R2Bucket;
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

const testEnv = env as unknown as WritableEnv;

const authFetch = (url: string, options?: RequestInit) =>
  SELF.fetch(url, {
    ...options,
    headers: {
      'Cf-Access-Authenticated-User-Email': 'test@example.com',
      ...options?.headers,
    },
  });

describe('Work Note File Preview Route', () => {
  beforeEach(async () => {
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

    const uploadRes = await authFetch('http://localhost/api/work-notes/WORK-123/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = (await uploadRes.json()) as { fileId: string };

    // View (inline)
    const viewRes = await authFetch(
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/view`
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(viewRes.headers.get('Content-Disposition')).toContain('inline;');
    expect(await viewRes.text()).toContain('hello pdf');

    // Download (attachment)
    const downloadRes = await authFetch(
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/download`
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(downloadRes.headers.get('Content-Disposition')).toContain('attachment;');
    expect(await downloadRes.text()).toContain('hello pdf');
  });
});
