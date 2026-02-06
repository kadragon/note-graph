// Trace: SPEC-worknote-attachments-1, TASK-057, TASK-058, TASK-066

import type { R2Bucket } from '@cloudflare/workers-types';
import { WorkNoteFileService } from '@worker/services/work-note-file-service';
import type { Env } from '@worker/types/env';
import { BadRequestError, NotFoundError } from '@worker/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockR2, setTestR2Bucket, testEnv } from '../test-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('WorkNoteFileService', () => {
  const baseEnv = testEnv as unknown as Env;
  let r2: MockR2;
  let service: WorkNoteFileService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let defaultFetchMockImplementation: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  let originalFetch: typeof global.fetch;
  let originalGoogleClientId: string | undefined;
  let originalGoogleClientSecret: string | undefined;
  let originalGoogleRedirectUri: string | undefined;
  let originalGdriveRootFolderId: string | undefined;
  const userEmail = 'tester@example.com';

  const insertWorkNote = async (workId: string, createdAt = new Date().toISOString()) => {
    await baseEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(workId, '테스트 업무노트', '내용', createdAt, createdAt)
      .run();
  };

  const insertOAuthToken = async () => {
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

  const insertLegacyR2File = async (params: {
    workId: string;
    fileId: string;
    r2Key: string;
    originalName: string;
    fileType: string;
    fileSize: number;
  }) => {
    const now = new Date().toISOString();
    await baseEnv.DB.prepare(
      `INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name, file_type, file_size,
        uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        params.fileId,
        params.workId,
        params.r2Key,
        params.originalName,
        params.fileType,
        params.fileSize,
        userEmail,
        now,
        'R2'
      )
      .run();
  };

  beforeEach(async () => {
    originalFetch = global.fetch;
    originalGoogleClientId = testEnv.GOOGLE_CLIENT_ID;
    originalGoogleClientSecret = testEnv.GOOGLE_CLIENT_SECRET;
    originalGoogleRedirectUri = testEnv.GOOGLE_REDIRECT_URI;
    originalGdriveRootFolderId = testEnv.GDRIVE_ROOT_FOLDER_ID;

    // Clean DB tables
    await baseEnv.DB.batch([
      baseEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      baseEnv.DB.prepare('DELETE FROM work_note_gdrive_folders'),
      baseEnv.DB.prepare('DELETE FROM work_note_files'),
      baseEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    r2 = new MockR2();
    setTestR2Bucket(r2 as unknown as R2Bucket);
    testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
    testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    testEnv.GOOGLE_REDIRECT_URI = 'https://example.test/oauth/callback';
    testEnv.GDRIVE_ROOT_FOLDER_ID = 'test-gdrive-root-folder-id';

    await insertOAuthToken();

    defaultFetchMockImplementation = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files/`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'FOLDER-1',
            name: 'WORK-123',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: 'https://drive.example/folder',
            size: '0',
            parents: ['FOLDER-OLD'],
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.includes('addParents=') && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          text: async () => '',
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
        if (url.includes('mimeType')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'FOLDER-YEAR-1',
              name: '2023',
              webViewLink: 'https://drive.example/year',
            }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'FOLDER-1',
            name: 'WORK-123',
            webViewLink: 'https://drive.example/folder',
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

      if (url.startsWith(`${DRIVE_API_BASE}/files/`) && method === 'DELETE') {
        return {
          ok: true,
          status: 204,
          text: async () => '',
        } as Response;
      }

      return originalFetch(input as RequestInfo, init as RequestInit);
    };

    fetchMock = vi.fn().mockImplementation(defaultFetchMockImplementation);

    global.fetch = fetchMock as typeof fetch;

    service = new WorkNoteFileService(r2 as unknown as R2Bucket, baseEnv.DB, baseEnv);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    testEnv.GOOGLE_CLIENT_ID = originalGoogleClientId as string;
    testEnv.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret as string;
    testEnv.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri as string;
    testEnv.GDRIVE_ROOT_FOLDER_ID = originalGdriveRootFolderId as string;
  });

  it('lists legacy R2 files even when Google Drive config is missing', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const fileId = 'FILE-R2-LEGACY';
    const r2Key = `work-notes/WORK-123/files/${fileId}`;

    await insertLegacyR2File({
      workId: 'WORK-123',
      fileId,
      r2Key,
      originalName: 'legacy.pdf',
      fileType: 'application/pdf',
      fileSize: 10,
    });

    const envWithoutGoogle = {
      ...baseEnv,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GDRIVE_ROOT_FOLDER_ID: '',
    } as Env;

    const legacyService = new WorkNoteFileService(
      r2 as unknown as R2Bucket,
      baseEnv.DB,
      envWithoutGoogle
    );

    const files = await legacyService.listFiles('WORK-123');

    expect(files).toHaveLength(1);
    expect(files[0]?.fileId).toBe(fileId);
  });

  it('uploads PDF and stores record', async () => {
    // Arrange
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    // Act
    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'document.pdf',
      uploadedBy: userEmail,
    });

    // Assert - return value
    expect(result.workId).toBe('WORK-123');
    expect(result.originalName).toBe('document.pdf');
    expect(result.fileType).toBe('application/pdf');
    expect(result.fileSize).toBe(file.size);
    expect(result.storageType).toBe('GDRIVE');
    expect(result.gdriveFileId).toBe('GFILE-1');
    expect(result.gdriveFolderId).toBe('FOLDER-1');
    expect(result.gdriveWebViewLink).toBe('https://drive.example/file');

    // Assert - DB record exists
    const row = await baseEnv.DB.prepare('SELECT * FROM work_note_files WHERE file_id = ?')
      .bind(result.fileId)
      .first<Record<string, unknown>>();
    expect(row).toBeTruthy();
    expect(row?.work_id).toBe('WORK-123');
    expect(row?.storage_type).toBe('GDRIVE');
  });

  it('uploads HWP file successfully', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['HWP content'], { type: 'application/x-hwp' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'report.hwp',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/x-hwp');
  });

  it('uploads HWPX file when browser sends empty mime type', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['HWPX content']); // default type = '' in browser for unknown extensions

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: '정책정보.hwpx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/vnd.hancom.hwpx');
  });

  it('uploads HWPX file when browser sends application/hwp+zip mime type', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['HWPX content'], { type: 'application/hwp+zip' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: '정책정보.hwpx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/vnd.hancom.hwpx');
  });

  it('uploads HWPX file when browser sends application/zip mime type', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['HWPX content'], { type: 'application/zip' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: '정책정보.hwpx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/vnd.hancom.hwpx');
  });

  it('uploads HWPX file when browser sends application/x-zip-compressed mime type', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['HWPX content'], { type: 'application/x-zip-compressed' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: '정책정보.hwpx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/vnd.hancom.hwpx');
  });

  it('uploads Excel file successfully', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['Excel content'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'data.xlsx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('uploads image file successfully', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['PNG data'], { type: 'image/png' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'screenshot.png',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('image/png');
  });

  it('normalizes image/jpg mime to image/jpeg', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['JPG data'], { type: 'image/jpg' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'photo.jpg',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('image/jpeg');
  });

  it('rejects files exceeding 50MB limit', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const oversized = { size: 51 * 1024 * 1024, type: 'application/pdf' } as unknown as Blob;

    await expect(
      service.uploadFile({
        workId: 'WORK-123',
        file: oversized,
        originalName: 'large.pdf',
        uploadedBy: userEmail,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('rejects unsupported file types', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const file = new Blob(['executable'], { type: 'application/x-msdownload' });

    await expect(
      service.uploadFile({
        workId: 'WORK-123',
        file,
        originalName: 'malware.exe',
        uploadedBy: userEmail,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('file.type: application/x-msdownload'),
    });
  });

  it('lists files for work note', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');

    // Upload two files
    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['1'], { type: 'application/pdf' }),
      originalName: 'file1.pdf',
      uploadedBy: userEmail,
    });

    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['2'], { type: 'image/png' }),
      originalName: 'file2.png',
      uploadedBy: userEmail,
    });

    // List files
    const files = await service.listFiles('WORK-123');

    expect(files).toHaveLength(2);
    const fileNames = files.map((f) => f.originalName);
    expect(fileNames).toContain('file1.pdf');
    expect(fileNames).toContain('file2.png');
  });

  it('gets file by ID', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const uploaded = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['content'], { type: 'application/pdf' }),
      originalName: 'test.pdf',
      uploadedBy: userEmail,
    });

    const file = await service.getFileById(uploaded.fileId);

    expect(file).not.toBeNull();
    expect(file?.fileId).toBe(uploaded.fileId);
    expect(file?.originalName).toBe('test.pdf');
  });

  it('returns null for non-existent file', async () => {
    const file = await service.getFileById('FILE-nonexistent');
    expect(file).toBeNull();
  });

  it('streams file from R2', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const fileId = 'FILE-R2-1';
    const r2Key = `work-notes/WORK-123/files/${fileId}`;
    const blob = new Blob(['file data'], { type: 'application/pdf' });
    await r2.put(r2Key, blob, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    await insertLegacyR2File({
      workId: 'WORK-123',
      fileId,
      r2Key,
      originalName: 'download.pdf',
      fileType: 'application/pdf',
      fileSize: blob.size,
    });

    const { body, headers } = await service.streamFile(fileId);

    expect(body).toBeTruthy();
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Content-Disposition')).toContain('download.pdf');
  });

  it('streams file inline when requested (for browser preview)', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const fileId = 'FILE-R2-2';
    const r2Key = `work-notes/WORK-123/files/${fileId}`;
    const blob = new Blob(['file data'], { type: 'application/pdf' });
    await r2.put(r2Key, blob, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    await insertLegacyR2File({
      workId: 'WORK-123',
      fileId,
      r2Key,
      originalName: 'preview.pdf',
      fileType: 'application/pdf',
      fileSize: blob.size,
    });

    const { headers } = await service.streamFile(fileId, true);

    expect(headers.get('Content-Disposition')).toContain('inline;');
    expect(headers.get('Content-Disposition')).toContain('preview.pdf');
  });

  it('throws NotFoundError when streaming non-existent file', async () => {
    await expect(service.streamFile('FILE-nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('reuses existing Drive file when appProperties match during migration', async () => {
    const workId = 'WORK-123';
    const fileId = 'FILE-R2-EXISTING';
    const r2Key = `work-notes/${workId}/files/${fileId}`;

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');
    await insertLegacyR2File({
      workId,
      fileId,
      r2Key,
      originalName: 'legacy.pdf',
      fileType: 'application/pdf',
      fileSize: 11,
    });

    await r2.put(r2Key, new Blob(['legacy'], { type: 'application/pdf' }));

    fetchMock.mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              {
                id: 'GFILE-EXISTING',
                name: 'legacy.pdf',
                mimeType: 'application/pdf',
                webViewLink: 'https://drive.example/existing',
                size: '11',
                appProperties: { workNoteFileId: fileId },
              },
            ],
          }),
        } as Response;
      }

      return defaultFetchMockImplementation(input, init);
    });

    const result = await service.migrateR2FilesToDrive(workId, userEmail);

    expect(result.migrated).toBe(1);
    expect(
      fetchMock.mock.calls.filter(([url, options]) => {
        const targetUrl = typeof url === 'string' ? url : url.toString();
        const method = (options as RequestInit | undefined)?.method;
        return targetUrl.startsWith(`${DRIVE_UPLOAD_BASE}/files`) && method === 'POST';
      })
    ).toHaveLength(0);

    const row = await baseEnv.DB.prepare(
      'SELECT storage_type, gdrive_file_id, gdrive_web_view_link FROM work_note_files WHERE file_id = ?'
    )
      .bind(fileId)
      .first<Record<string, unknown>>();

    expect(row).toEqual({
      storage_type: 'GDRIVE',
      gdrive_file_id: 'GFILE-EXISTING',
      gdrive_web_view_link: 'https://drive.example/existing',
    });

    expect(await r2.get(r2Key)).toBeNull();
  });

  it('rolls back Drive upload when DB update fails during migration', async () => {
    const workId = 'WORK-456';
    const fileId = 'FILE-R2-FAIL';
    const r2Key = `work-notes/${workId}/files/${fileId}`;

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');
    await insertLegacyR2File({
      workId,
      fileId,
      r2Key,
      originalName: 'rollback.pdf',
      fileType: 'application/pdf',
      fileSize: 6,
    });

    await r2.put(r2Key, new Blob(['rollback'], { type: 'application/pdf' }));

    const failingDb = new Proxy(baseEnv.DB, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (query: string) => {
            if (query.includes('UPDATE work_note_files')) {
              throw new Error('DB update failed');
            }
            return target.prepare(query);
          };
        }
        const value = target[prop as keyof typeof target];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const failingService = new WorkNoteFileService(
      r2 as unknown as R2Bucket,
      failingDb as unknown as Env['DB'],
      baseEnv
    );

    const result = await failingService.migrateR2FilesToDrive(workId, userEmail);

    expect(result.failed).toBe(1);
    expect(await r2.get(r2Key)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFILE-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('deletes file from R2 and DB', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');
    const uploaded = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['data'], { type: 'application/pdf' }),
      originalName: 'delete-me.pdf',
      uploadedBy: userEmail,
    });

    await service.deleteFile(uploaded.fileId, userEmail);

    // Assert - DB record soft deleted
    const row = await baseEnv.DB.prepare('SELECT deleted_at FROM work_note_files WHERE file_id = ?')
      .bind(uploaded.fileId)
      .first<Record<string, unknown>>();
    expect(row?.deleted_at).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFILE-1`,
      expect.objectContaining({ method: 'DELETE' })
    );

    // Assert - Not returned by getFileById
    const file = await service.getFileById(uploaded.fileId);
    expect(file).toBeNull();
  });

  it('deletes all files for work note', async () => {
    await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');

    // Upload two files
    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['1'], { type: 'application/pdf' }),
      originalName: 'file1.pdf',
      uploadedBy: userEmail,
    });

    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['2'], { type: 'image/png' }),
      originalName: 'file2.png',
      uploadedBy: userEmail,
    });

    // Delete all files for work note (Google Drive)
    await service.deleteWorkNoteFiles('WORK-123', userEmail);

    expect(fetchMock).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/FOLDER-1`,
      expect.objectContaining({ method: 'DELETE' })
    );

    // Assert - DB records still exist (will be cleaned up by CASCADE when work note is deleted)
    const rows = await baseEnv.DB.prepare('SELECT file_id FROM work_note_files WHERE work_id = ?')
      .bind('WORK-123')
      .all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(2);

    // Simulate work note deletion (CASCADE deletes file records)
    await baseEnv.DB.prepare('DELETE FROM work_notes WHERE work_id = ?').bind('WORK-123').run();

    // Assert - DB records cleaned up by CASCADE
    const rowsAfterCascade = await baseEnv.DB.prepare(
      'SELECT file_id FROM work_note_files WHERE work_id = ?'
    )
      .bind('WORK-123')
      .all<Record<string, unknown>>();
    expect(rowsAfterCascade.results).toHaveLength(0);
  });

  describe('uploadFileToDrive', () => {
    it('uploads file to Drive and returns DriveFileListItem without DB record', async () => {
      await insertWorkNote('WORK-UPLOAD', '2023-05-01T00:00:00.000Z');
      const file = new Blob(['PDF content'], { type: 'application/pdf' });

      const result = await service.uploadFileToDrive({
        workId: 'WORK-UPLOAD',
        file,
        originalName: 'document.pdf',
        uploadedBy: userEmail,
      });

      // Assert - DriveFileListItem format
      expect(result.id).toBe('GFILE-1');
      expect(result.name).toBe('document.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.webViewLink).toBe('https://drive.example/file');
      expect(result.size).toBe(file.size);
      expect(result.modifiedTime).toBeDefined();

      // Assert - No DB record created
      const rows = await baseEnv.DB.prepare('SELECT file_id FROM work_note_files WHERE work_id = ?')
        .bind('WORK-UPLOAD')
        .all<Record<string, unknown>>();
      expect(rows.results).toHaveLength(0);

      // Assert - Drive folder record created
      const folder = await baseEnv.DB.prepare(
        'SELECT gdrive_folder_id FROM work_note_gdrive_folders WHERE work_id = ?'
      )
        .bind('WORK-UPLOAD')
        .first<Record<string, unknown>>();
      expect(folder?.gdrive_folder_id).toBe('FOLDER-1');
    });
  });

  describe('deleteDriveFile', () => {
    it('deletes file from Drive by Drive file ID', async () => {
      await service.deleteDriveFile('GFILE-TO-DELETE', userEmail);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DRIVE_API_BASE}/files/GFILE-TO-DELETE`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('listFilesFromDrive', () => {
    it('lists files directly from Drive folder', async () => {
      await insertWorkNote('WORK-123', '2023-05-01T00:00:00.000Z');

      // Create Drive folder record
      await baseEnv.DB.prepare(
        `INSERT INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
         VALUES (?, ?, ?, ?)`
      )
        .bind('WORK-123', 'FOLDER-123', 'https://drive.google.com/folder', new Date().toISOString())
        .run();

      const mockDriveFiles = [
        {
          id: 'file-1',
          name: 'document.pdf',
          mimeType: 'application/pdf',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
          size: '1024',
          modifiedTime: '2024-01-15T10:00:00.000Z',
        },
        {
          id: 'file-2',
          name: 'image.png',
          mimeType: 'image/png',
          webViewLink: 'https://drive.google.com/file/d/file-2/view',
          size: '2048',
          modifiedTime: '2024-01-16T12:00:00.000Z',
        },
      ];

      fetchMock.mockImplementation(async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = (init as RequestInit).method ?? 'GET';

        // Check if this is a list files request (URL-encoded 'in parents')
        if (url.includes('/files?') && url.includes('in%20parents') && method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: mockDriveFiles }),
          } as Response;
        }

        return defaultFetchMockImplementation(input, init);
      });

      const result = await service.listFilesFromDrive('WORK-123', userEmail);

      expect(result.googleDriveConfigured).toBe(true);
      expect(result.driveFolderId).toBe('FOLDER-123');
      expect(result.driveFolderLink).toBe('https://drive.google.com/folder');
      expect(result.hasLegacyFiles).toBe(false);
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        id: 'file-1',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/d/file-1/view',
        size: 1024,
        modifiedTime: '2024-01-15T10:00:00.000Z',
      });
    });

    it('returns empty files when no Drive folder exists', async () => {
      await insertWorkNote('WORK-456', '2023-05-01T00:00:00.000Z');

      const result = await service.listFilesFromDrive('WORK-456', userEmail);

      expect(result.googleDriveConfigured).toBe(true);
      expect(result.driveFolderId).toBeNull();
      expect(result.driveFolderLink).toBeNull();
      expect(result.hasLegacyFiles).toBe(false);
      expect(result.files).toEqual([]);
    });

    it('returns empty files when Drive folder id is missing', async () => {
      await insertWorkNote('WORK-EMPTY', '2023-05-01T00:00:00.000Z');

      await baseEnv.DB.prepare(
        `INSERT INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
         VALUES (?, ?, ?, ?)`
      )
        .bind('WORK-EMPTY', '', '', new Date().toISOString())
        .run();

      const result = await service.listFilesFromDrive('WORK-EMPTY', userEmail);

      expect(result.googleDriveConfigured).toBe(true);
      expect(result.driveFolderId).toBeNull();
      expect(result.driveFolderLink).toBeNull();
      expect(result.files).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('/files?'),
        expect.anything()
      );
    });

    it('sets hasLegacyFiles when R2 files exist', async () => {
      await insertWorkNote('WORK-789', '2023-05-01T00:00:00.000Z');

      // Insert legacy R2 file
      await insertLegacyR2File({
        workId: 'WORK-789',
        fileId: 'FILE-LEGACY',
        r2Key: 'work-notes/WORK-789/files/FILE-LEGACY',
        originalName: 'legacy.pdf',
        fileType: 'application/pdf',
        fileSize: 100,
      });

      const result = await service.listFilesFromDrive('WORK-789', userEmail);

      expect(result.hasLegacyFiles).toBe(true);
      expect(result.files).toEqual([]);
    });

    it('returns unconfigured when Google Drive env vars missing', async () => {
      const envWithoutGoogle = {
        ...baseEnv,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GDRIVE_ROOT_FOLDER_ID: '',
      } as Env;

      const noGoogleService = new WorkNoteFileService(
        r2 as unknown as R2Bucket,
        baseEnv.DB,
        envWithoutGoogle
      );

      await insertWorkNote('WORK-NOGOOGLE', '2023-05-01T00:00:00.000Z');

      const result = await noGoogleService.listFilesFromDrive('WORK-NOGOOGLE', userEmail);

      expect(result.googleDriveConfigured).toBe(false);
      expect(result.driveFolderId).toBeNull();
      expect(result.files).toEqual([]);
    });
  });
});
