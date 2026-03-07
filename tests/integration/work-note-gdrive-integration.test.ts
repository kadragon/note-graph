// Trace: TASK-066, Phase-6.5
// Integration test for Google Drive attachment lifecycle in work notes

import { WorkNoteFileService } from '@worker/services/work-note-file-service';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockEnv, MockR2, mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('Work Note Google Drive Integration', () => {
  const workId = 'WORK-123';
  const userEmail = 'test@example.com';

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  let originalFetch: typeof global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let mockR2: MockR2;
  let mockEnv: Env;

  beforeEach(async () => {
    originalFetch = global.fetch;
    mockR2 = new MockR2();

    mockEnv = buildMockEnv({
      R2_BUCKET: mockR2 as unknown as R2Bucket,
      VECTORIZE: {
        query: vi.fn().mockResolvedValue({ matches: [] }),
        upsert: vi.fn(),
        deleteByIds: vi.fn(),
      } as unknown as VectorizeIndex,
    });

    await pgCleanupAll(pglite);

    await pglite.query(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [workId, 'Drive Test Note', '내용', '2023-05-01T00:00:00.000Z', now]
    );

    await pglite.query(
      `INSERT INTO google_oauth_tokens
        (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userEmail,
        'access-token',
        'refresh-token',
        'Bearer',
        expiresAt,
        'https://www.googleapis.com/auth/drive',
        now,
        now,
      ]
    );

    let folderCreateCount = 0;
    fetchMock = vi.fn().mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
        folderCreateCount += 1;
        if (folderCreateCount === 1) {
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
            name: workId,
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
            name: 'drive.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.example/file',
            size: '9',
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uploads, downloads, and cleans up Google Drive attachments on delete', async () => {
    const fileService = new WorkNoteFileService(mockR2 as unknown as R2Bucket, testPgDb, mockEnv);
    const uploaded = await fileService.uploadFile({
      workId,
      file: new Blob(['drive data'], { type: 'application/pdf' }),
      originalName: 'drive.pdf',
      uploadedBy: userEmail,
    });

    expect(uploaded.storageType).toBe('GDRIVE');
    expect(uploaded.gdriveWebViewLink).toBe('https://drive.example/file');

    const stored = await fileService.getFileById(uploaded.fileId);
    expect(stored?.storageType).toBe('GDRIVE');
    expect(stored?.gdriveWebViewLink).toBe('https://drive.example/file');
    const workNoteService = new WorkNoteService(testPgDb, mockEnv);
    const { cleanupPromise } = await workNoteService.delete(workId, userEmail);
    await cleanupPromise;

    const deleteUrls = fetchMock.mock.calls
      .filter(([url, options]) => {
        const targetUrl = typeof url === 'string' ? url : url.toString();
        const method = (options as RequestInit | undefined)?.method;
        return targetUrl.startsWith(`${DRIVE_API_BASE}/files/`) && method === 'DELETE';
      })
      .map(([url]) => (typeof url === 'string' ? url : url.toString()));

    expect(deleteUrls).toEqual([`${DRIVE_API_BASE}/files/FOLDER-1`]);
  });

  it('migrates legacy R2 work note files to Google Drive', async () => {
    const fileId = 'FILE-R2-1';
    const r2Key = `work-notes/${workId}/files/${fileId}`;

    await pglite.query(
      `INSERT INTO work_note_files
        (file_id, work_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, deleted_at, storage_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [fileId, workId, r2Key, 'legacy.pdf', 'application/pdf', 9, userEmail, now, null, 'R2']
    );

    await mockR2.put(r2Key, new Blob(['r2 data'], { type: 'application/pdf' }));

    const fileService = new WorkNoteFileService(mockR2 as unknown as R2Bucket, testPgDb, mockEnv);

    const result = await fileService.migrateR2FilesToDrive(workId, userEmail);

    expect(result.migrated).toBe(1);
    expect(result.failed).toBe(0);

    const updated = await pglite.query<{
      storage_type: string;
      gdrive_file_id: string | null;
      gdrive_web_view_link: string | null;
    }>(
      `SELECT storage_type, gdrive_file_id, gdrive_web_view_link FROM work_note_files WHERE file_id = $1`,
      [fileId]
    );

    expect(updated.rows[0]?.storage_type).toBe('GDRIVE');
    expect(updated.rows[0]?.gdrive_file_id).toBe('GFILE-1');
    expect(updated.rows[0]?.gdrive_web_view_link).toBe('https://drive.example/file');

    const r2Object = await mockR2.get(r2Key);
    expect(r2Object).toBeNull();
  });
});
