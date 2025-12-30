// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-TYPE-SAFE-MOCKS

import type { R2Bucket } from '@cloudflare/workers-types';
import { jest } from '@jest/globals';
import type { ProjectFile } from '@shared/types/project';
import {
  asR2Bucket,
  createMockEmbeddingProcessor,
  createMockFetch,
  createMockTextExtractor,
  createMockVectorizeService,
  InMemoryR2Bucket,
  type MockEmbeddingProcessor,
  type MockTextExtractor,
  type MockVectorizeService,
} from '@test-helpers/mock-helpers';
import { ProjectFileService } from '@worker/services/project-file-service';
import type { Env } from '@worker/types/env';
import { BadRequestError, NotFoundError } from '@worker/types/errors';

interface TestProjectFileService {
  vectorizeService: MockVectorizeService;
  textExtractor: MockTextExtractor;
  embeddingProcessor: MockEmbeddingProcessor;
}

describe('ProjectFileService', () => {
  let db: any;
  let baseEnv: Env;
  let r2: InMemoryR2Bucket;
  let service: ProjectFileService;
  let mockVectorize: MockVectorizeService;
  let mockEmbeddingProcessor: MockEmbeddingProcessor;
  let mockTextExtractor: MockTextExtractor;

  const insertProject = async (projectId: string) => {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
      )
      .bind(projectId, '테스트 프로젝트', now, now)
      .run();
  };

  beforeEach(async () => {
    // Get database from Jest/Miniflare global
    const getDB = (global as any).getDB;
    db = await getDB();

    // Create baseEnv with the database
    baseEnv = {
      DB: db,
    } as unknown as Env;

    // Clean DB tables
    await db.batch([db.prepare('DELETE FROM project_files'), db.prepare('DELETE FROM projects')]);

    // Fresh mocks using type-safe helpers
    r2 = new InMemoryR2Bucket();
    mockVectorize = createMockVectorizeService();
    mockEmbeddingProcessor = createMockEmbeddingProcessor();
    mockTextExtractor = createMockTextExtractor('파일 내용입니다');

    // Stub fetch used by OpenAIEmbeddingService
    global.fetch = createMockFetch({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0), index: 0 }],
      }),
    }) as any;

    service = new ProjectFileService(baseEnv, asR2Bucket(r2), db);

    // Override internals for determinism
    (service as unknown as TestProjectFileService).vectorizeService = mockVectorize;
    (service as unknown as TestProjectFileService).embeddingProcessor = mockEmbeddingProcessor;
    (service as unknown as TestProjectFileService).textExtractor = mockTextExtractor;
  });

  it('uploads PDF, stores record, and embeds with project metadata', async () => {
    // Arrange
    await insertProject('PROJECT-123');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    // Act
    const result = await service.uploadFile({
      projectId: 'PROJECT-123',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    // Assert - return value
    expect(result.projectId).toBe('PROJECT-123');
    expect(result.originalName).toBe('spec.pdf');
    expect(result.embeddedAt).not.toBeNull();

    // Assert - DB record exists
    const row = await db
      .prepare('SELECT * FROM project_files WHERE file_id = ?')
      .bind(result.fileId)
      .first();
    expect(row).toBeTruthy();

    // Assert - R2 stored at expected key
    expect(r2.storage.has(result.r2Key)).toBe(true);

    // Assert - EmbeddingProcessor.upsertChunks called with project metadata
    expect(mockEmbeddingProcessor.upsertChunks).toHaveBeenCalledTimes(1);
    const chunksArg = mockEmbeddingProcessor.upsertChunks.mock.calls[0][0];
    expect(chunksArg[0].metadata.project_id).toBe('PROJECT-123');
  });

  it('rejects files exceeding 50MB limit', async () => {
    const oversized = { size: 51 * 1024 * 1024, type: 'application/pdf' } as unknown as Blob;

    await expect(
      service.uploadFile({
        projectId: 'PROJECT-1',
        file: oversized,
        originalName: 'big.pdf',
        uploadedBy: 'tester@example.com',
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects unsupported mime types', async () => {
    const zipFile = new Blob(['dummy'], { type: 'application/zip' });

    await expect(
      service.uploadFile({
        projectId: 'PROJECT-1',
        file: zipFile,
        originalName: 'archive.zip',
        uploadedBy: 'tester@example.com',
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('uploads file when browser sends empty mime type using extension fallback', async () => {
    await insertProject('PROJECT-123');
    const file = new Blob(['PDF content']); // empty mime type

    const result = await service.uploadFile({
      projectId: 'PROJECT-123',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    expect(result.fileType).toBe('application/pdf');
    const stored = r2.storage.get(result.r2Key);
    expect(stored?.httpMetadata?.contentType).toBe('application/pdf');
  });

  it('deletes file, marking DB and removing embeddings', async () => {
    // Arrange - seed DB and R2
    const now = new Date().toISOString();
    await insertProject('PROJECT-1');
    await db
      .prepare(
        `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, embedded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'FILE-123',
        'PROJECT-1',
        'projects/PROJECT-1/files/FILE-123',
        'spec.pdf',
        'application/pdf',
        1024,
        'tester@example.com',
        now,
        now
      )
      .run();
    r2.storage.set('projects/PROJECT-1/files/FILE-123', { value: new Blob(['pdf']) });
    mockVectorize.query.mockResolvedValue({
      count: 2,
      matches: [
        { id: 'FILE-123#chunk0', score: 1 },
        { id: 'FILE-123#chunk1', score: 1 },
      ],
    });

    // Act
    await service.deleteFile('FILE-123');

    // Assert - DB soft delete
    const deleted = await db
      .prepare('SELECT deleted_at FROM project_files WHERE file_id = ?')
      .bind('FILE-123')
      .first();
    expect(deleted?.deleted_at).toBeDefined();

    // Assert - R2 object removed
    expect(r2.storage.has('projects/PROJECT-1/files/FILE-123')).toBe(false);

    // Assert - embeddings deletion invoked
    expect(mockVectorize.query).toHaveBeenCalled();
    expect(mockVectorize.delete).toHaveBeenCalledWith(['FILE-123#chunk0', 'FILE-123#chunk1']);
  });

  it('returns download URL and streams file with headers', async () => {
    // Arrange
    const now = new Date().toISOString();
    const fileId = 'FILE-789';
    await insertProject('PROJECT-9');
    await db
      .prepare(
        `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fileId,
        'PROJECT-9',
        `projects/PROJECT-9/files/${fileId}`,
        'doc.pdf',
        'application/pdf',
        2048,
        'user@example.com',
        now
      )
      .run();
    r2.storage.set(`projects/PROJECT-9/files/${fileId}`, {
      value: new Blob(['hello'], { type: 'application/pdf' }),
    });

    // Act
    const url = await service.getDownloadUrl(fileId);
    const streamed = await service.streamFile(fileId);

    // Assert
    expect(url).toBe(`/api/projects/PROJECT-9/files/${fileId}/download`);
    expect(streamed.headers.get('Content-Type')).toBe('application/pdf');
    expect(streamed.headers.get('Content-Length')).toBe('2048');
  });

  it('lists project files with metadata', async () => {
    const now = new Date().toISOString();
    await insertProject('PROJECT-LIST');

    await db.batch([
      db
        .prepare(
          `INSERT INTO project_files (
				file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          'FILE-1',
          'PROJECT-LIST',
          'projects/PROJECT-LIST/files/FILE-1',
          'a.pdf',
          'application/pdf',
          100,
          'u@example.com',
          now
        ),
      db
        .prepare(
          `INSERT INTO project_files (
				file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          'FILE-2',
          'PROJECT-LIST',
          'projects/PROJECT-LIST/files/FILE-2',
          'b.png',
          'image/png',
          200,
          'u@example.com',
          now
        ),
    ]);

    const files = await service.listFiles('PROJECT-LIST');

    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject<Partial<ProjectFile>>({
      projectId: 'PROJECT-LIST',
      originalName: expect.any(String),
      fileType: expect.any(String),
      fileSize: expect.any(Number),
    });
  });

  it('throws NotFoundError when streaming missing file', async () => {
    await expect(service.streamFile('MISSING')).rejects.toBeInstanceOf(NotFoundError);
  });
});
