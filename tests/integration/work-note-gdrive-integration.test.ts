// Trace: TASK-066, Phase-6.5
// Integration test for Google Drive attachment lifecycle in work notes

import { WorkNoteFileService } from '@worker/services/work-note-file-service';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockR2, setTestR2Bucket, testEnv } from '../test-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('Work Note Google Drive Integration', () => {
  const workId = 'WORK-123';
  const userEmail = 'test@example.com';

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  let originalFetch: typeof global.fetch;
  let originalGoogleClientId: string | undefined;
  let originalGoogleClientSecret: string | undefined;
  let originalGoogleRedirectUri: string | undefined;
  let originalGdriveRootFolderId: string | undefined;
  let originalVectorize: unknown;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    originalFetch = global.fetch;
    originalGoogleClientId = testEnv.GOOGLE_CLIENT_ID;
    originalGoogleClientSecret = testEnv.GOOGLE_CLIENT_SECRET;
    originalGoogleRedirectUri = testEnv.GOOGLE_REDIRECT_URI;
    originalGdriveRootFolderId = testEnv.GDRIVE_ROOT_FOLDER_ID;
    originalVectorize = testEnv.VECTORIZE;

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      testEnv.DB.prepare('DELETE FROM work_note_gdrive_folders'),
      testEnv.DB.prepare('DELETE FROM work_note_files'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    setTestR2Bucket(new MockR2());
    testEnv.VECTORIZE = {
      query: vi.fn().mockResolvedValue({ matches: [] }),
      upsert: vi.fn(),
      deleteByIds: vi.fn(),
    } as unknown;

    testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
    testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    testEnv.GOOGLE_REDIRECT_URI = 'https://example.test/oauth/callback';
    testEnv.GDRIVE_ROOT_FOLDER_ID = 'test-gdrive-root-folder-id';

    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(workId, 'Drive Test Note', '내용', now, now)
      .run();

    await testEnv.DB.prepare(
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

    fetchMock = vi.fn().mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
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
    testEnv.GOOGLE_CLIENT_ID = originalGoogleClientId as string;
    testEnv.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret as string;
    testEnv.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri as string;
    testEnv.GDRIVE_ROOT_FOLDER_ID = originalGdriveRootFolderId as string;
    testEnv.VECTORIZE = originalVectorize as typeof testEnv.VECTORIZE;
  });

  it('uploads, downloads, and cleans up Google Drive attachments on delete', async () => {
    const fileService = new WorkNoteFileService(
      testEnv.R2_BUCKET,
      testEnv.DB,
      testEnv as unknown as Env
    );
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
    const workNoteService = new WorkNoteService(testEnv as unknown as Env);
    await workNoteService.delete(workId, userEmail);

    await new Promise((resolve) => setTimeout(resolve, 0));

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

    await testEnv.DB.prepare(
      `INSERT INTO work_note_files
        (file_id, work_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, deleted_at, storage_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(fileId, workId, r2Key, 'legacy.pdf', 'application/pdf', 9, userEmail, now, null, 'R2')
      .run();

    await testEnv.R2_BUCKET.put(r2Key, new Blob(['r2 data'], { type: 'application/pdf' }));

    const fileService = new WorkNoteFileService(
      testEnv.R2_BUCKET,
      testEnv.DB,
      testEnv as unknown as Env
    );

    const result = await fileService.migrateR2FilesToDrive(workId, userEmail);

    expect(result.migrated).toBe(1);
    expect(result.failed).toBe(0);

    const updated = await testEnv.DB.prepare(
      `SELECT storage_type, gdrive_file_id, gdrive_web_view_link FROM work_note_files WHERE file_id = ?`
    )
      .bind(fileId)
      .first<{
        storage_type: string;
        gdrive_file_id: string | null;
        gdrive_web_view_link: string | null;
      }>();

    expect(updated?.storage_type).toBe('GDRIVE');
    expect(updated?.gdrive_file_id).toBe('GFILE-1');
    expect(updated?.gdrive_web_view_link).toBe('https://drive.example/file');

    const r2Object = await testEnv.R2_BUCKET.get(r2Key);
    expect(r2Object).toBeNull();
  });
});
