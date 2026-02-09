// Trace: TASK-044
// Integration test for Drive-backed project file upload response payload

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, MockR2, setTestR2Bucket, testEnv } from '../test-setup';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

describe('Project File Routes - Drive upload payload', () => {
  const userEmail = 'test@example.com';
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  let originalFetch: typeof global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    originalFetch = global.fetch;

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM google_oauth_tokens'),
      testEnv.DB.prepare('DELETE FROM project_gdrive_folders'),
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM projects'),
    ]);

    setTestR2Bucket(new MockR2() as unknown as typeof testEnv.R2_BUCKET);

    testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
    testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    testEnv.GOOGLE_REDIRECT_URI = 'https://example.test/oauth/callback';
    testEnv.GDRIVE_ROOT_FOLDER_ID = 'test-gdrive-root-folder-id';

    await testEnv.DB.prepare(
      `INSERT INTO projects (project_id, name, status, created_at, updated_at)
       VALUES (?, ?, '진행중', ?, ?)`
    )
      .bind('PROJECT-DRIVE-POST', 'Drive 업로드 테스트', '2024-01-15T00:00:00.000Z', now)
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
        'https://www.googleapis.com/auth/drive',
        now,
        now
      )
      .run();

    let createdFolderCount = 0;
    fetchMock = vi.fn().mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init as RequestInit).method ?? 'GET';

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'GET') {
        const decodedUrl = decodeURIComponent(url);
        if (decodedUrl.includes("name = '2024'")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              files:
                createdFolderCount >= 1
                  ? [
                      {
                        id: 'FOLDER-YEAR-POST',
                        name: '2024',
                        webViewLink: 'https://drive.example/year-post',
                        parents: ['test-gdrive-root-folder-id'],
                      },
                    ]
                  : [],
            }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files?`) && method === 'POST') {
        createdFolderCount += 1;
        if (createdFolderCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'FOLDER-YEAR-POST',
              name: '2024',
              webViewLink: 'https://drive.example/year-post',
            }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'FOLDER-PROJECT-POST',
            name: 'PROJECT-DRIVE-POST',
            webViewLink: 'https://drive.example/project-folder-post',
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files/FOLDER-PROJECT-POST?`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'FOLDER-PROJECT-POST',
            name: 'PROJECT-DRIVE-POST',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: 'https://drive.example/project-folder-post',
            size: '0',
            parents: ['FOLDER-YEAR-POST'],
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_API_BASE}/files/FOLDER-PROJECT-POST?`) && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'FOLDER-PROJECT-POST',
            parents: ['FOLDER-YEAR-POST'],
          }),
        } as Response;
      }

      if (url.startsWith(`${DRIVE_UPLOAD_BASE}/files`) && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'GFILE-POST-1',
            name: 'drive-image.png',
            mimeType: 'image/png',
            webViewLink: 'https://drive.example/file-post',
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

  it('POST /api/projects/:projectId/files returns Drive-backed file payload', async () => {
    const form = new FormData();
    form.append('file', new Blob(['png-bytes'], { type: 'image/png' }), 'drive-image.png');

    const response = await authFetch('http://localhost/api/projects/PROJECT-DRIVE-POST/files', {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(201);
    const uploaded = await response.json<Record<string, unknown>>();
    expect(uploaded.storageType).toBe('GDRIVE');
    expect(uploaded.gdriveFileId).toBe('GFILE-POST-1');
    expect(uploaded.gdriveFolderId).toBe('FOLDER-PROJECT-POST');
    expect(uploaded.gdriveWebViewLink).toBe('https://drive.example/file-post');
    expect(uploaded.r2Key).toBe('');
  });

  it('GET /api/projects/:projectId/files returns Drive metadata fields', async () => {
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'FILE-LIST-DRIVE-1',
        'PROJECT-DRIVE-POST',
        '',
        'drive-list.pdf',
        'application/pdf',
        10,
        userEmail,
        now,
        'GDRIVE',
        'GFILE-LIST-1',
        'GFOLDER-LIST-1',
        'https://drive.example/file-list-1'
      )
      .run();

    const response = await authFetch('http://localhost/api/projects/PROJECT-DRIVE-POST/files');

    expect(response.status).toBe(200);
    const files = await response.json<Array<Record<string, unknown>>>();
    expect(files).toHaveLength(1);
    expect(files[0]?.storageType).toBe('GDRIVE');
    expect(files[0]?.gdriveFileId).toBe('GFILE-LIST-1');
    expect(files[0]?.gdriveFolderId).toBe('GFOLDER-LIST-1');
    expect(files[0]?.gdriveWebViewLink).toBe('https://drive.example/file-list-1');
  });

  it('GET /api/projects/:projectId/files/:fileId/download redirects for GDRIVE and streams for legacy R2', async () => {
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'FILE-DOWNLOAD-DRIVE-1',
        'PROJECT-DRIVE-POST',
        '',
        'drive-download.pdf',
        'application/pdf',
        11,
        userEmail,
        now,
        'GDRIVE',
        'GFILE-DOWNLOAD-1',
        'GFOLDER-DOWNLOAD-1',
        'https://drive.example/file-download-1'
      )
      .run();

    const legacyR2Key = 'projects/PROJECT-DRIVE-POST/files/FILE-DOWNLOAD-R2-1';
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'FILE-DOWNLOAD-R2-1',
        'PROJECT-DRIVE-POST',
        legacyR2Key,
        'legacy-download.txt',
        'text/plain',
        10,
        userEmail,
        now,
        'R2'
      )
      .run();
    await testEnv.R2_BUCKET.put(legacyR2Key, new Blob(['legacy-r2'], { type: 'text/plain' }));

    const driveResponse = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files/FILE-DOWNLOAD-DRIVE-1/download',
      { redirect: 'manual' }
    );
    expect(driveResponse.status).toBe(302);
    expect(driveResponse.headers.get('Location')).toBe('https://drive.example/file-download-1');

    const r2Response = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files/FILE-DOWNLOAD-R2-1/download'
    );
    expect(r2Response.status).toBe(200);
    expect(r2Response.headers.get('Content-Type')).toBe('text/plain');
    expect(await r2Response.text()).toBe('legacy-r2');
  });

  it('DELETE /api/projects/:projectId/files/:fileId deletes Drive file', async () => {
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
        storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'FILE-DELETE-DRIVE-1',
        'PROJECT-DRIVE-POST',
        '',
        'drive-delete.pdf',
        'application/pdf',
        12,
        userEmail,
        now,
        'GDRIVE',
        'GFILE-DELETE-1',
        'GFOLDER-DELETE-1',
        'https://drive.example/file-delete-1'
      )
      .run();

    const response = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files/FILE-DELETE-DRIVE-1',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);

    const deleted = await testEnv.DB.prepare(
      `SELECT deleted_at as deletedAt FROM project_files WHERE file_id = ?`
    )
      .bind('FILE-DELETE-DRIVE-1')
      .first<{ deletedAt: string | null }>();
    expect(deleted?.deletedAt).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(
      `${DRIVE_API_BASE}/files/GFILE-DELETE-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('POST /api/projects/:projectId/files/migrate migrates legacy R2 files and returns summary', async () => {
    const legacyR2Key = 'projects/PROJECT-DRIVE-POST/files/FILE-MIGRATE-R2-1';
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'FILE-MIGRATE-R2-1',
        'PROJECT-DRIVE-POST',
        legacyR2Key,
        'legacy-migrate.txt',
        'text/plain',
        12,
        userEmail,
        now,
        'R2'
      )
      .run();
    await testEnv.R2_BUCKET.put(legacyR2Key, new Blob(['legacy-migrate'], { type: 'text/plain' }));

    const response = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files/migrate',
      { method: 'POST' }
    );

    expect(response.status).toBe(200);
    const summary = await response.json<Record<string, unknown>>();
    expect(summary).toEqual({ migrated: 1, skipped: 0, failed: 0 });

    const row = await testEnv.DB.prepare(
      `SELECT storage_type as storageType, gdrive_file_id as gdriveFileId, gdrive_folder_id as gdriveFolderId
       FROM project_files
       WHERE file_id = ?`
    )
      .bind('FILE-MIGRATE-R2-1')
      .first<{ storageType: string; gdriveFileId: string | null; gdriveFolderId: string | null }>();

    expect(row?.storageType).toBe('GDRIVE');
    expect(row?.gdriveFileId).toBe('GFILE-POST-1');
    expect(row?.gdriveFolderId).toBe('FOLDER-PROJECT-POST');
    expect(await testEnv.R2_BUCKET.get(legacyR2Key)).toBeNull();
  });

  it('supports consistent mixed-storage lifecycle across upload/list/download/delete/migrate', async () => {
    const uploadForm = new FormData();
    uploadForm.append('file', new Blob(['drive-file'], { type: 'image/png' }), 'drive-e2e.png');

    const uploadResponse = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files',
      {
        method: 'POST',
        body: uploadForm,
      }
    );
    expect(uploadResponse.status).toBe(201);

    const uploadedDriveFile = await uploadResponse.json<{
      fileId: string;
      storageType: string;
      r2Key: string;
    }>();
    expect(uploadedDriveFile.storageType).toBe('GDRIVE');
    expect(uploadedDriveFile.r2Key).toBe('');

    const legacyFileId = 'FILE-MIXED-R2-1';
    const legacyR2Key = `projects/PROJECT-DRIVE-POST/files/${legacyFileId}`;
    await testEnv.DB.prepare(
      `INSERT INTO project_files (
        file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        legacyFileId,
        'PROJECT-DRIVE-POST',
        legacyR2Key,
        'legacy-mixed.txt',
        'text/plain',
        12,
        userEmail,
        now,
        'R2'
      )
      .run();
    await testEnv.R2_BUCKET.put(legacyR2Key, new Blob(['legacy-mixed'], { type: 'text/plain' }));

    const listBeforeResponse = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files'
    );
    expect(listBeforeResponse.status).toBe(200);
    const listBefore =
      await listBeforeResponse.json<
        Array<{
          fileId: string;
          storageType: string;
          r2Key: string;
          gdriveWebViewLink: string | null;
        }>
      >();
    expect(listBefore).toHaveLength(2);

    const byIdBefore = new Map(listBefore.map((file) => [file.fileId, file]));
    expect(byIdBefore.get(uploadedDriveFile.fileId)?.storageType).toBe('GDRIVE');
    expect(byIdBefore.get(uploadedDriveFile.fileId)?.r2Key).toBe('');
    expect(byIdBefore.get(legacyFileId)?.storageType).toBe('R2');
    expect(byIdBefore.get(legacyFileId)?.r2Key).toBe(legacyR2Key);

    const driveDownloadResponse = await authFetch(
      `http://localhost/api/projects/PROJECT-DRIVE-POST/files/${uploadedDriveFile.fileId}/download`,
      { redirect: 'manual' }
    );
    expect(driveDownloadResponse.status).toBe(302);
    expect(driveDownloadResponse.headers.get('Location')).toBe('https://drive.example/file-post');

    const r2DownloadResponse = await authFetch(
      `http://localhost/api/projects/PROJECT-DRIVE-POST/files/${legacyFileId}/download`
    );
    expect(r2DownloadResponse.status).toBe(200);
    expect(await r2DownloadResponse.text()).toBe('legacy-mixed');

    const deleteDriveResponse = await authFetch(
      `http://localhost/api/projects/PROJECT-DRIVE-POST/files/${uploadedDriveFile.fileId}`,
      { method: 'DELETE' }
    );
    expect(deleteDriveResponse.status).toBe(204);

    const migrateResponse = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files/migrate',
      { method: 'POST' }
    );
    expect(migrateResponse.status).toBe(200);
    const migrateSummary = await migrateResponse.json<{
      migrated: number;
      skipped: number;
      failed: number;
    }>();
    expect(migrateSummary).toEqual({ migrated: 1, skipped: 0, failed: 0 });

    const listAfterResponse = await authFetch(
      'http://localhost/api/projects/PROJECT-DRIVE-POST/files'
    );
    expect(listAfterResponse.status).toBe(200);
    const listAfter =
      await listAfterResponse.json<
        Array<{
          fileId: string;
          storageType: string;
          r2Key: string;
          gdriveWebViewLink: string | null;
        }>
      >();

    expect(listAfter).toHaveLength(1);
    expect(listAfter[0]?.fileId).toBe(legacyFileId);
    expect(listAfter[0]?.storageType).toBe('GDRIVE');
    expect(listAfter[0]?.r2Key).toBe('');
    expect(listAfter[0]?.gdriveWebViewLink).toBe('https://drive.example/file-post');
    expect(await testEnv.R2_BUCKET.get(legacyR2Key)).toBeNull();
  });
});
