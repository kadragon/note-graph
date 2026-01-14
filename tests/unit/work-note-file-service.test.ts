// Trace: SPEC-worknote-attachments-1, TASK-057, TASK-058, TASK-066

import type { R2Bucket } from '@cloudflare/workers-types';
import { WorkNoteFileService } from '@worker/services/work-note-file-service';
import type { Env } from '@worker/types/env';
import { BadRequestError, DomainError, NotFoundError } from '@worker/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockR2, setTestR2Bucket, testEnv } from '../test-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('WorkNoteFileService', () => {
  const baseEnv = testEnv as unknown as Env;
  let r2: MockR2;
  let service: WorkNoteFileService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;
  let originalGoogleClientId: string | undefined;
  let originalGoogleClientSecret: string | undefined;
  let originalGoogleRedirectUri: string | undefined;
  const userEmail = 'tester@example.com';

  const insertWorkNote = async (workId: string) => {
    const now = new Date().toISOString();
    await baseEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(workId, '테스트 업무노트', '내용', now, now)
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
        'https://www.googleapis.com/auth/drive.file',
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

    // Clean DB tables
    await baseEnv.DB.batch([
      baseEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      baseEnv.DB.prepare('DELETE FROM work_note_gdrive_folders'),
      baseEnv.DB.prepare('DELETE FROM work_note_files'),
      baseEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    r2 = new MockR2();
    setTestR2Bucket(r2);
    testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
    testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    testEnv.GOOGLE_REDIRECT_URI = 'https://example.test/oauth/callback';

    await insertOAuthToken();

    fetchMock = vi.fn().mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
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
    });

    global.fetch = fetchMock as typeof fetch;

    service = new WorkNoteFileService(r2 as unknown as R2Bucket, baseEnv.DB, baseEnv);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    testEnv.GOOGLE_CLIENT_ID = originalGoogleClientId as string;
    testEnv.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret as string;
    testEnv.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri as string;
  });

  it('throws when Google OAuth credentials are missing', () => {
    const envWithoutGoogle = {
      ...baseEnv,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    } as Env;

    expect(
      () => new WorkNoteFileService(r2 as unknown as R2Bucket, baseEnv.DB, envWithoutGoogle)
    ).toThrow(DomainError);
  });

  it('uploads PDF and stores record', async () => {
    // Arrange
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
    const file = new Blob(['HWPX content']); // default type = '' in browser for unknown extensions

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: '정책정보.hwpx',
      uploadedBy: userEmail,
    });

    expect(result.fileType).toBe('application/vnd.hancom.hwpx');
  });

  it('uploads Excel file successfully', async () => {
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
    const file = new Blob(['executable'], { type: 'application/x-msdownload' });

    await expect(
      service.uploadFile({
        workId: 'WORK-123',
        file,
        originalName: 'malware.exe',
        uploadedBy: userEmail,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('lists files for work note', async () => {
    await insertWorkNote('WORK-123');

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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');
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

  it('deletes file from R2 and DB', async () => {
    await insertWorkNote('WORK-123');
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
    await insertWorkNote('WORK-123');

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
});
