// Trace: SPEC-worknote-attachments-1, TASK-066
// Integration tests for work note file upload route (Google Drive)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, MockR2, setTestR2Bucket, testEnv } from '../test-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('Work Note File Upload Route', () => {
  let originalFetch: typeof global.fetch;
  let originalGoogleClientId: string | undefined;
  let originalGoogleClientSecret: string | undefined;
  let originalGoogleRedirectUri: string | undefined;
  let originalGdriveRootFolderId: string | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    originalFetch = global.fetch;
    originalGoogleClientId = testEnv.GOOGLE_CLIENT_ID;
    originalGoogleClientSecret = testEnv.GOOGLE_CLIENT_SECRET;
    originalGoogleRedirectUri = testEnv.GOOGLE_REDIRECT_URI;
    originalGdriveRootFolderId = testEnv.GDRIVE_ROOT_FOLDER_ID;

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      testEnv.DB.prepare('DELETE FROM work_note_files'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
    testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    testEnv.GOOGLE_REDIRECT_URI = 'https://example.test/oauth/callback';
    testEnv.GDRIVE_ROOT_FOLDER_ID = 'test-gdrive-root-folder-id';

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createdAt = '2023-05-01T00:00:00.000Z';

    // Seed minimal work note
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind('WORK-123', '테스트 업무노트', '내용', createdAt, now)
      .run();

    await testEnv.DB.prepare(
      `INSERT INTO google_oauth_tokens
        (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'test@example.com',
        'access-token',
        'refresh-token',
        'Bearer',
        expiresAt,
        'https://www.googleapis.com/auth/drive',
        now,
        now
      )
      .run();

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

      if (url.includes('addParents=') && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          text: async () => '',
        } as Response;
      }

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
            name: 'hello.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.example/file',
            size: '9',
          }),
        } as Response;
      }

      return originalFetch(input as RequestInfo, init as RequestInit);
    });

    global.fetch = fetchMock as typeof fetch;

    // Provide mock R2 binding for legacy streaming routes
    setTestR2Bucket(new MockR2() as unknown as typeof testEnv.R2_BUCKET);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    testEnv.GOOGLE_CLIENT_ID = originalGoogleClientId as string;
    testEnv.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret as string;
    testEnv.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri as string;
    testEnv.GDRIVE_ROOT_FOLDER_ID = originalGdriveRootFolderId as string;
  });

  it('uploads file to Google Drive and returns DriveFileListItem', async () => {
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch('http://localhost/api/work-notes/WORK-123/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);

    // New response format: DriveFileListItem
    const uploaded = (await uploadRes.json()) as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
      size: number;
      modifiedTime: string;
    };

    expect(uploaded.id).toBe('GFILE-1');
    expect(uploaded.name).toBe('hello.pdf');
    expect(uploaded.mimeType).toBe('application/pdf');
    expect(uploaded.webViewLink).toBe('https://drive.example/file');
    expect(fetchMock).toHaveBeenCalled();

    // Verify no DB record was created (Drive folder is source of truth)
    const dbFiles = await testEnv.DB.prepare('SELECT * FROM work_note_files WHERE work_id = ?')
      .bind('WORK-123')
      .all();
    expect(dbFiles.results).toHaveLength(0);

    // Verify Drive folder record was created
    const folderRecord = await testEnv.DB.prepare(
      'SELECT * FROM work_note_gdrive_folders WHERE work_id = ?'
    )
      .bind('WORK-123')
      .first();
    expect(folderRecord).toBeTruthy();
  });
});
