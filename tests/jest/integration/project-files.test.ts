// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-005
// Integration tests for project file routes (Jest)

import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import { jest } from '@jest/globals';
import type { ProjectFile } from '@shared/types/project';
import type { Env } from '@worker/types/env';
import { BadRequestError, NotFoundError } from '@worker/types/errors';

const uploadFile = jest.fn<any>();
const listFiles = jest.fn<any>();
const streamFile = jest.fn<any>();
const deleteFile = jest.fn<any>();
const getFileById = jest.fn<any>();

class MockService {
  uploadFile = uploadFile;
  listFiles = listFiles;
  streamFile = streamFile;
  deleteFile = deleteFile;
  getFileById = getFileById;
}

await jest.unstable_mockModule('@worker/services/project-file-service', () => {
  return {
    ProjectFileService: MockService,
    uploadFile,
    listFiles,
    streamFile,
    deleteFile,
    getFileById,
  };
});

await jest.unstable_mockModule('@/services/project-file-service', () => {
  return {
    ProjectFileService: MockService,
    uploadFile,
    listFiles,
    streamFile,
    deleteFile,
    getFileById,
  };
});

const { default: app } = await import('@worker/index');

type WritableEnv = {
  -readonly [K in keyof Env]: Env[K];
};

interface GlobalWithTestR2 {
  __TEST_R2_BUCKET: R2Bucket;
}

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

const createExecutionContext = () => ({
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
});

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

describe('Project File Routes', () => {
  let testEnv: WritableEnv;

  beforeEach(async () => {
    testEnv = (await createTestEnv()) as WritableEnv;

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);

    // Seed minimal project
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
    )
      .bind('PROJECT-FILE', '파일 테스트 프로젝트', now, now)
      .run();

    // Mock R2 bucket binding
    testEnv.R2_BUCKET = new MockR2() as unknown as R2Bucket;
    (globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET = testEnv.R2_BUCKET;

    uploadFile.mockReset();
    listFiles.mockReset();
    streamFile.mockReset();
    deleteFile.mockReset();
  });

  it('uploads, lists, downloads, and deletes a PDF file', async () => {
    uploadFile.mockResolvedValue({
      fileId: 'FILE-123',
      projectId: 'PROJECT-FILE',
      r2Key: 'projects/PROJECT-FILE/files/FILE-123',
      originalName: 'hello.pdf',
      fileType: 'application/pdf',
      fileSize: 9,
      uploadedBy: 'test@example.com',
      uploadedAt: new Date().toISOString(),
      embeddedAt: null,
      deletedAt: null,
    } as ProjectFile);

    listFiles.mockResolvedValue([
      {
        fileId: 'FILE-123',
        projectId: 'PROJECT-FILE',
        r2Key: 'projects/PROJECT-FILE/files/FILE-123',
        originalName: 'hello.pdf',
        fileType: 'application/pdf',
        fileSize: 9,
        uploadedBy: 'test@example.com',
        uploadedAt: new Date().toISOString(),
        embeddedAt: null,
        deletedAt: null,
      },
    ]);

    streamFile
      .mockImplementationOnce(() => ({
        body: new Blob(['hello pdf']).stream(),
        headers: new Headers({ 'Content-Type': 'application/pdf', 'Content-Length': '9' }),
      }))
      .mockRejectedValueOnce(new NotFoundError('File', 'FILE-123'));

    deleteFile.mockResolvedValue(undefined);
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch(testEnv, 'http://localhost/api/projects/PROJECT-FILE/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json<{ fileId: string }>();
    expect(uploaded.fileId).toMatch(/^FILE-/);

    // List
    const listRes = await authFetch(testEnv, 'http://localhost/api/projects/PROJECT-FILE/files');
    expect(listRes.status).toBe(200);
    const files = await listRes.json<Array<{ fileId: string; originalName: string }>>();
    expect(files).toHaveLength(1);
    expect(files[0].originalName).toBe('hello.pdf');

    // Download
    const dlRes = await authFetch(
      testEnv,
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}/download`
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(await dlRes.text()).toContain('hello pdf');

    // Delete
    const delRes = await authFetch(
      testEnv,
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}`,
      {
        method: 'DELETE',
      }
    );
    expect(delRes.status).toBe(204);

    // Download after delete should 404
    const dlAfter = await authFetch(
      testEnv,
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}/download`
    );
    expect(dlAfter.status).toBe(404);
  });

  it('rejects file above 50MB', async () => {
    uploadFile.mockRejectedValue(
      new BadRequestError('파일 크기가 제한을 초과했습니다. 최대 50MB까지 업로드 가능합니다.')
    );
    const big = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', big, 'too-big.pdf');

    const res = await authFetch(testEnv, 'http://localhost/api/projects/PROJECT-FILE/files', {
      method: 'POST',
      body: form,
    });

    expect(res.status).toBe(400);
  });
});
