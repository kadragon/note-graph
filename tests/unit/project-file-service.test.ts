// Trace: SPEC-project-1, SPEC-refactor-file-service, TASK-044, TASK-REFACTOR-003

import { env } from 'cloudflare:test';
import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import type { ProjectFile } from '@shared/types/project';
import { ProjectFileService } from '@worker/services/project-file-service';
import type { Env } from '@worker/types/env';
import { BadRequestError, type DomainError, NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simple in-memory R2 mock
class MockR2Bucket implements R2Bucket {
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
      arrayBuffer: async () => await entry.value.arrayBuffer(),
      // Minimal fields used by service
      size: entry.value.size,
      writeHttpMetadata: () => {},
      httpEtag: '',
      httpMetadata: entry.httpMetadata ?? {},
      customMetadata: entry.customMetadata ?? {},
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  // Unused methods for this test suite
  async head(): Promise<R2Object | null> {
    return null;
  }
}

interface TestProjectFileService extends ProjectFileService {
  vectorizeService: typeof mockVectorize;
  textExtractor: typeof mockTextExtractor;
  embeddingProcessor: { upsertChunks: ReturnType<typeof vi.fn> };
}

describe('ProjectFileService', () => {
  const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
  const baseEnv = env as unknown as Env;
  let r2: MockR2Bucket;
  let service: ProjectFileService;
  let mockVectorize: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  let mockEmbeddingProcessor: { upsertChunks: ReturnType<typeof vi.fn> };
  let mockTextExtractor: { extractText: ReturnType<typeof vi.fn> };

  const insertProject = async (projectId: string) => {
    const now = new Date().toISOString();
    await baseEnv.DB.prepare(
      `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
    )
      .bind(projectId, '테스트 프로젝트', now, now)
      .run();
  };

  const insertOAuthToken = async (userEmail: string) => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await baseEnv.DB.prepare(
      `INSERT INTO google_oauth_tokens
        (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userEmail,
        'access-token',
        'refresh-token',
        'Bearer',
        expiresAt,
        'https://www.googleapis.com/auth/drive',
        now,
        now
      )
      .run();
  };

  beforeEach(async () => {
    // Clean DB tables
    await baseEnv.DB.batch([
      baseEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      baseEnv.DB.prepare('DELETE FROM project_gdrive_folders'),
      baseEnv.DB.prepare('DELETE FROM project_files'),
      baseEnv.DB.prepare('DELETE FROM projects'),
    ]);

    // Fresh mocks
    r2 = new MockR2Bucket();
    mockVectorize = {
      insert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ matches: [] }),
    };
    mockEmbeddingProcessor = {
      upsertChunks: vi.fn().mockResolvedValue(undefined),
    };
    mockTextExtractor = {
      extractText: vi.fn().mockResolvedValue({ success: true, text: '파일 내용입니다' }),
    };

    await insertOAuthToken('tester@example.com');

    // Stub fetch used by Google Drive + OpenAIEmbeddingService
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: url.includes('mimeType') ? 'FOLDER-YEAR-1' : 'FOLDER-PROJECT-1',
            name: url.includes('mimeType') ? '2026' : 'PROJECT-TEST',
            webViewLink: url.includes('mimeType')
              ? 'https://drive.example/year'
              : 'https://drive.example/folder',
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_UPLOAD_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'GFILE-1',
            name: 'document.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.example/file',
            size: '11',
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0), index: 0 }],
        }),
      } as Response;
    }) as typeof fetch;

    service = new ProjectFileService(baseEnv, r2 as unknown as R2Bucket, baseEnv.DB);

    // Override internals for determinism
    (service as TestProjectFileService).vectorizeService = mockVectorize;
    (service as TestProjectFileService).embeddingProcessor = mockEmbeddingProcessor;
    (service as TestProjectFileService).textExtractor = mockTextExtractor;
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
    const row = await baseEnv.DB.prepare('SELECT * FROM project_files WHERE file_id = ?')
      .bind(result.fileId)
      .first<Record<string, unknown>>();
    expect(row).toBeTruthy();

    // Assert - Drive-backed upload does not duplicate into R2
    const storageRow = await baseEnv.DB.prepare(
      'SELECT storage_type, r2_key FROM project_files WHERE file_id = ?'
    )
      .bind(result.fileId)
      .first<{ storage_type: string; r2_key: string }>();
    expect(storageRow?.storage_type).toBe('GDRIVE');
    expect(storageRow?.r2_key).toBe('');
    expect(r2.storage.size).toBe(0);

    // Assert - EmbeddingProcessor.upsertChunks called with project metadata
    expect(mockEmbeddingProcessor.upsertChunks).toHaveBeenCalledTimes(1);
    const chunksArg = mockEmbeddingProcessor.upsertChunks.mock.calls[0][0];
    expect(chunksArg[0].metadata.project_id).toBe('PROJECT-123');
  });

  it('uploads file to Drive and persists GDRIVE metadata', async () => {
    await insertProject('PROJECT-DRIVE-1');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: url.includes('mimeType') ? 'FOLDER-YEAR-1' : 'FOLDER-PROJECT-1',
            name: url.includes('mimeType') ? '2026' : 'PROJECT-DRIVE-1',
            webViewLink: url.includes('mimeType')
              ? 'https://drive.example/year'
              : 'https://drive.example/folder',
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_UPLOAD_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'GFILE-1',
            name: 'spec.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.example/file',
            size: String(file.size),
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0), index: 0 }],
        }),
      } as Response;
    }) as typeof fetch;

    const result = await service.uploadFile({
      projectId: 'PROJECT-DRIVE-1',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    const row = await baseEnv.DB.prepare(
      `SELECT storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
       FROM project_files WHERE file_id = ?`
    )
      .bind(result.fileId)
      .first<{
        storage_type: string;
        gdrive_file_id: string | null;
        gdrive_folder_id: string | null;
        gdrive_web_view_link: string | null;
      }>();

    expect(row).toMatchObject({
      storage_type: 'GDRIVE',
      gdrive_file_id: 'GFILE-1',
      gdrive_folder_id: 'FOLDER-PROJECT-1',
      gdrive_web_view_link: 'https://drive.example/file',
    });
  });

  it('runs embedding flow and sets embedded_at for text-extractable Drive uploads', async () => {
    await insertProject('PROJECT-DRIVE-EMBED');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    const result = await service.uploadFile({
      projectId: 'PROJECT-DRIVE-EMBED',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    const row = await baseEnv.DB.prepare(
      `SELECT storage_type, embedded_at
       FROM project_files
       WHERE file_id = ?`
    )
      .bind(result.fileId)
      .first<{ storage_type: string; embedded_at: string | null }>();

    expect(row?.storage_type).toBe('GDRIVE');
    expect(row?.embedded_at).not.toBeNull();
    expect(mockEmbeddingProcessor.upsertChunks).toHaveBeenCalledTimes(1);
  });

  it('fails fast with configuration error when Drive env vars are missing', async () => {
    await insertProject('PROJECT-CONFIG-ERROR');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    const envWithoutDriveConfig = {
      ...baseEnv,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GDRIVE_ROOT_FOLDER_ID: '',
    } as Env;
    const driveRequiredService = new ProjectFileService(
      envWithoutDriveConfig,
      r2 as unknown as R2Bucket,
      baseEnv.DB
    );

    (driveRequiredService as TestProjectFileService).vectorizeService = mockVectorize;
    (driveRequiredService as TestProjectFileService).embeddingProcessor = mockEmbeddingProcessor;
    (driveRequiredService as TestProjectFileService).textExtractor = mockTextExtractor;

    await expect(
      driveRequiredService.uploadFile({
        projectId: 'PROJECT-CONFIG-ERROR',
        file,
        originalName: 'spec.pdf',
        uploadedBy: 'tester@example.com',
      })
    ).rejects.toMatchObject<Partial<DomainError>>({
      code: 'CONFIGURATION_ERROR',
    });
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
    ).rejects.toMatchObject({
      message: expect.stringContaining('file.type: application/zip'),
    });
  });

  it('uploads file when browser sends empty mime type using extension fallback', async () => {
    await insertProject('PROJECT-123');
    const file = new Blob(['PDF content']); // empty mime type

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: url.includes('mimeType') ? 'FOLDER-YEAR-1' : 'FOLDER-PROJECT-1',
            name: url.includes('mimeType') ? '2026' : 'PROJECT-123',
            webViewLink: url.includes('mimeType')
              ? 'https://drive.example/year'
              : 'https://drive.example/folder',
          }),
        } as Response;
      }

      // Force Drive upload failure to exercise R2 fallback path
      if (url.startsWith(`${DRIVE_UPLOAD_BASE}/files`) && method === 'POST') {
        return {
          ok: false,
          status: 500,
          text: async () => 'Drive upload failed',
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0), index: 0 }],
        }),
      } as Response;
    }) as typeof fetch;

    const result = await service.uploadFile({
      projectId: 'PROJECT-123',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    expect(result.fileType).toBe('application/pdf');
    expect(result.r2Key).toContain('projects/PROJECT-123/files/FILE-');
    const stored = r2.storage.get(result.r2Key);
    expect(stored?.httpMetadata?.contentType).toBe('application/pdf');
  });

  it('deletes file, marking DB and removing embeddings', async () => {
    // Arrange - seed DB and R2
    const now = new Date().toISOString();
    await insertProject('PROJECT-1');
    await baseEnv.DB.prepare(
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
      matches: [
        { id: 'FILE-123#chunk0', score: 1 },
        { id: 'FILE-123#chunk1', score: 1 },
      ],
    });

    // Act
    await service.deleteFile('FILE-123');

    // Assert - DB soft delete
    const deleted = await baseEnv.DB.prepare(
      'SELECT deleted_at FROM project_files WHERE file_id = ?'
    )
      .bind('FILE-123')
      .first<{ deleted_at: string }>();
    expect(deleted?.deleted_at).toBeDefined();

    // Assert - R2 object removed
    expect(r2.storage.has('projects/PROJECT-1/files/FILE-123')).toBe(false);

    // Assert - embeddings deletion invoked
    expect(mockVectorize.query).toHaveBeenCalled();
    expect(mockVectorize.delete).toHaveBeenCalledWith(['FILE-123#chunk0', 'FILE-123#chunk1']);
  });

  it('deletes Google Drive file when storage_type is GDRIVE', async () => {
    const now = new Date().toISOString();
    const fileId = 'FILE-GDRIVE-DELETE';
    await insertProject('PROJECT-GDRIVE-DELETE');

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        'PROJECT-GDRIVE-DELETE',
        '',
        'drive-doc.pdf',
        'application/pdf',
        512,
        'tester@example.com',
        now,
        'GDRIVE',
        'GFILE-DELETE-1'
      )
      .run();

    await service.deleteFile(fileId, 'tester@example.com');

    const deleted = await baseEnv.DB.prepare(
      'SELECT deleted_at FROM project_files WHERE file_id = ?'
    )
      .bind(fileId)
      .first<{ deleted_at: string | null }>();

    expect(deleted?.deleted_at).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFILE-DELETE-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws BAD_REQUEST when deleting GDRIVE file without userEmail', async () => {
    const now = new Date().toISOString();
    const fileId = 'FILE-GDRIVE-DELETE-NO-EMAIL';
    await insertProject('PROJECT-GDRIVE-DELETE-NO-EMAIL');

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        'PROJECT-GDRIVE-DELETE-NO-EMAIL',
        '',
        'drive-doc.pdf',
        'application/pdf',
        512,
        'tester@example.com',
        now,
        'GDRIVE',
        'GFILE-DELETE-2'
      )
      .run();

    await expect(service.deleteFile(fileId)).rejects.toMatchObject<Partial<DomainError>>({
      code: 'BAD_REQUEST',
    });

    const deleted = await baseEnv.DB.prepare(
      'SELECT deleted_at FROM project_files WHERE file_id = ?'
    )
      .bind(fileId)
      .first<{ deleted_at: string | null }>();
    expect(deleted?.deleted_at).toBeNull();
  });

  it('deletes R2 object when storage_type is R2', async () => {
    const now = new Date().toISOString();
    const fileId = 'FILE-R2-DELETE';
    const r2Key = `projects/PROJECT-R2-DELETE/files/${fileId}`;
    await insertProject('PROJECT-R2-DELETE');

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        'PROJECT-R2-DELETE',
        r2Key,
        'legacy.pdf',
        'application/pdf',
        256,
        'tester@example.com',
        now,
        'R2'
      )
      .run();

    r2.storage.set(r2Key, { value: new Blob(['legacy']) });

    await service.deleteFile(fileId);

    expect(r2.storage.has(r2Key)).toBe(false);
  });

  it('migrates only legacy R2 files to Drive and updates file metadata', async () => {
    const now = new Date().toISOString();
    const projectId = 'PROJECT-MIGRATE-1';
    const legacyFileId = 'FILE-R2-LEGACY-1';
    const legacyR2Key = `projects/${projectId}/files/${legacyFileId}`;
    const driveFileId = 'FILE-GDRIVE-EXISTING-1';
    await insertProject(projectId);

    await baseEnv.DB.batch([
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
          file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        legacyFileId,
        projectId,
        legacyR2Key,
        'legacy.pdf',
        'application/pdf',
        10,
        'tester@example.com',
        now,
        'R2'
      ),
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
          file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
          storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        driveFileId,
        projectId,
        '',
        'already-drive.pdf',
        'application/pdf',
        11,
        'tester@example.com',
        now,
        'GDRIVE',
        'GFILE-EXISTING',
        'GFOLDER-EXISTING',
        'https://drive.example/existing'
      ),
    ]);

    r2.storage.set(legacyR2Key, { value: new Blob(['legacy'], { type: 'application/pdf' }) });

    const result = await service.migrateR2FilesToDrive(projectId, 'tester@example.com');

    expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 });

    const migratedRow = await baseEnv.DB.prepare(
      `SELECT storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
       FROM project_files WHERE file_id = ?`
    )
      .bind(legacyFileId)
      .first<Record<string, unknown>>();
    expect(migratedRow).toMatchObject({
      storage_type: 'GDRIVE',
      gdrive_file_id: 'GFILE-1',
      gdrive_folder_id: 'FOLDER-PROJECT-1',
      gdrive_web_view_link: 'https://drive.example/file',
    });
    expect(r2.storage.has(legacyR2Key)).toBe(false);

    const untouchedDriveRow = await baseEnv.DB.prepare(
      'SELECT storage_type, gdrive_file_id FROM project_files WHERE file_id = ?'
    )
      .bind(driveFileId)
      .first<Record<string, unknown>>();
    expect(untouchedDriveRow).toEqual({
      storage_type: 'GDRIVE',
      gdrive_file_id: 'GFILE-EXISTING',
    });
  });

  it('skips legacy entries with missing R2 object during migration and reports skipped count', async () => {
    const now = new Date().toISOString();
    const projectId = 'PROJECT-MIGRATE-SKIP';
    const presentFileId = 'FILE-R2-PRESENT';
    const presentR2Key = `projects/${projectId}/files/${presentFileId}`;
    const missingFileId = 'FILE-R2-MISSING';
    const missingR2Key = `projects/${projectId}/files/${missingFileId}`;
    await insertProject(projectId);

    await baseEnv.DB.batch([
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
          file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        presentFileId,
        projectId,
        presentR2Key,
        'present.pdf',
        'application/pdf',
        10,
        'tester@example.com',
        now,
        'R2'
      ),
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
          file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        missingFileId,
        projectId,
        missingR2Key,
        'missing.pdf',
        'application/pdf',
        10,
        'tester@example.com',
        now,
        'R2'
      ),
    ]);

    r2.storage.set(presentR2Key, { value: new Blob(['exists'], { type: 'application/pdf' }) });

    const result = await service.migrateR2FilesToDrive(projectId, 'tester@example.com');

    expect(result).toEqual({ migrated: 1, skipped: 1, failed: 0 });

    const missingRow = await baseEnv.DB.prepare(
      'SELECT storage_type, gdrive_file_id FROM project_files WHERE file_id = ?'
    )
      .bind(missingFileId)
      .first<Record<string, unknown>>();

    expect(missingRow).toEqual({
      storage_type: 'R2',
      gdrive_file_id: null,
    });
  });

  it('rolls back uploaded Drive file when DB update fails during migration', async () => {
    const now = new Date().toISOString();
    const projectId = 'PROJECT-MIGRATE-ROLLBACK';
    const fileId = 'FILE-R2-ROLLBACK';
    const r2Key = `projects/${projectId}/files/${fileId}`;
    await insertProject(projectId);

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        projectId,
        r2Key,
        'rollback.pdf',
        'application/pdf',
        9,
        'tester@example.com',
        now,
        'R2'
      )
      .run();

    r2.storage.set(r2Key, { value: new Blob(['rollback'], { type: 'application/pdf' }) });

    const failingDb = new Proxy(baseEnv.DB, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (query: string) => {
            if (query.includes('UPDATE project_files')) {
              throw new Error('DB update failed');
            }
            return target.prepare(query);
          };
        }

        const value = target[prop as keyof typeof target];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const failingService = new ProjectFileService(
      baseEnv,
      r2 as unknown as R2Bucket,
      failingDb as unknown as Env['DB']
    );
    (failingService as TestProjectFileService).vectorizeService = mockVectorize;
    (failingService as TestProjectFileService).embeddingProcessor = mockEmbeddingProcessor;
    (failingService as TestProjectFileService).textExtractor = mockTextExtractor;

    const result = await failingService.migrateR2FilesToDrive(projectId, 'tester@example.com');

    expect(result).toEqual({ migrated: 0, skipped: 0, failed: 1 });
    expect(r2.storage.has(r2Key)).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFILE-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('deletes linked Drive folder during project cleanup when folder mapping exists', async () => {
    const now = new Date().toISOString();
    const projectId = 'PROJECT-CLEANUP-DRIVE';
    await insertProject(projectId);

    await baseEnv.DB.prepare(
      `INSERT INTO project_gdrive_folders (project_id, gdrive_folder_id, gdrive_folder_link, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(projectId, 'GFOLDER-CLEANUP-1', 'https://drive.example/folder', now)
      .run();

    const result = await service.archiveProjectFiles(projectId, 'tester@example.com');

    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(global.fetch).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFOLDER-CLEANUP-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('restores project Drive folder mapping when Drive deletion fails during cleanup', async () => {
    const now = new Date().toISOString();
    const projectId = 'PROJECT-CLEANUP-DRIVE-ROLLBACK';
    await insertProject(projectId);

    await baseEnv.DB.prepare(
      `INSERT INTO project_gdrive_folders (project_id, gdrive_folder_id, gdrive_folder_link, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(projectId, 'GFOLDER-CLEANUP-ROLLBACK-1', 'https://drive.example/folder-rollback', now)
      .run();

    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';

      if (url === `${DRIVE_API_BASE}/files/GFOLDER-CLEANUP-ROLLBACK-1` && method === 'DELETE') {
        return {
          ok: false,
          status: 500,
          text: async () => 'Drive delete failed',
        } as Response;
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const result = await service.archiveProjectFiles(projectId, 'tester@example.com');

    expect(result).toEqual({ succeeded: [], failed: [] });
    const mapping = await baseEnv.DB.prepare(
      `SELECT gdrive_folder_id as folderId
       FROM project_gdrive_folders
       WHERE project_id = ?`
    )
      .bind(projectId)
      .first<{ folderId: string | null }>();
    expect(mapping?.folderId).toBe('GFOLDER-CLEANUP-ROLLBACK-1');
  });

  it('returns download URL and streams file with headers', async () => {
    // Arrange
    const now = new Date().toISOString();
    const fileId = 'FILE-789';
    await insertProject('PROJECT-9');
    await baseEnv.DB.prepare(
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

  it('does not duplicate file into R2 when Drive upload succeeds', async () => {
    await insertProject('PROJECT-DRIVE-NO-R2-DUP');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    const result = await service.uploadFile({
      projectId: 'PROJECT-DRIVE-NO-R2-DUP',
      file,
      originalName: 'spec.pdf',
      uploadedBy: 'tester@example.com',
    });

    const row = await baseEnv.DB.prepare(
      `SELECT storage_type, r2_key FROM project_files WHERE file_id = ?`
    )
      .bind(result.fileId)
      .first<{ storage_type: string; r2_key: string }>();

    expect(row?.storage_type).toBe('GDRIVE');
    expect(row?.r2_key).toBe('');
    expect(r2.storage.size).toBe(0);
  });

  it('returns download route for GDRIVE file without requiring an R2 object', async () => {
    const now = new Date().toISOString();
    const fileId = 'FILE-GDRIVE-DOWNLOAD';
    await insertProject('PROJECT-GDRIVE-DOWNLOAD');

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        'PROJECT-GDRIVE-DOWNLOAD',
        '',
        'doc.pdf',
        'application/pdf',
        128,
        'user@example.com',
        now,
        'GDRIVE',
        'GFILE-123',
        'GFOLDER-123',
        'https://drive.example/file'
      )
      .run();

    await expect(service.getDownloadUrl(fileId)).resolves.toBe(
      `/api/projects/PROJECT-GDRIVE-DOWNLOAD/files/${fileId}/download`
    );
  });

  it('keeps legacy R2 download behavior by requiring an existing R2 object', async () => {
    const now = new Date().toISOString();
    const fileId = 'FILE-R2-MISSING-OBJECT';
    await insertProject('PROJECT-R2-DOWNLOAD');

    await baseEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fileId,
        'PROJECT-R2-DOWNLOAD',
        `projects/PROJECT-R2-DOWNLOAD/files/${fileId}`,
        'legacy.pdf',
        'application/pdf',
        64,
        'user@example.com',
        now,
        'R2'
      )
      .run();

    await expect(service.getDownloadUrl(fileId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists project files with metadata', async () => {
    const now = new Date().toISOString();
    await insertProject('PROJECT-LIST');

    await baseEnv.DB.batch([
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
					file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        'FILE-1',
        'PROJECT-LIST',
        'projects/PROJECT-LIST/files/FILE-1',
        'a.pdf',
        'application/pdf',
        100,
        'u@example.com',
        now
      ),
      baseEnv.DB.prepare(
        `INSERT INTO project_files (
					file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
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
