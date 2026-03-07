// Trace: SPEC-worknote-attachments-1, TASK-066
// Integration tests for work note file upload route (Google Drive)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockR2, mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('Work Note File Upload Route', () => {
  let originalFetch: typeof global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const mockR2 = new MockR2();
  const authFetch = createAuthFetch(worker, {
    R2_BUCKET: mockR2 as unknown as R2Bucket,
  });

  beforeEach(async () => {
    originalFetch = global.fetch;

    await pgCleanupAll(pglite);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createdAt = '2023-05-01T00:00:00.000Z';

    // Seed minimal work note
    await pglite.query(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      ['WORK-123', '테스트 업무노트', '내용', createdAt, now]
    );

    await pglite.query(
      `INSERT INTO google_oauth_tokens
        (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'test@example.com',
        'access-token',
        'refresh-token',
        'Bearer',
        expiresAt,
        'https://www.googleapis.com/auth/drive',
        now,
        now,
      ]
    );

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uploads file to Google Drive and returns DriveFileListItem', async () => {
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch('/api/work-notes/WORK-123/files', {
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
    const dbFiles = await pglite.query('SELECT * FROM work_note_files WHERE work_id = $1', [
      'WORK-123',
    ]);
    expect(dbFiles.rows).toHaveLength(0);

    // Verify Drive folder record was created
    const folderRecord = await pglite.query(
      'SELECT * FROM work_note_gdrive_folders WHERE work_id = $1',
      ['WORK-123']
    );
    expect(folderRecord.rows.length).toBeGreaterThan(0);
  });
});
