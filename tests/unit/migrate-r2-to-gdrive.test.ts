import type { R2Bucket } from '@cloudflare/workers-types';
import { createPgliteConnection } from '@worker/adapters/pglite-connection';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import type { DatabaseClient } from '@worker/types/database';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateR2WorkNoteFiles, runMigrationCli } from '../../scripts/migrate-r2-to-gdrive';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { MockR2 } from '../helpers/test-app';
import { pglite } from '../pg-setup';

describe('migrateR2WorkNoteFiles', () => {
  const getDb = () => new SupabaseDatabaseClient(createPgliteConnection(pglite));

  const insertWorkNote = async (workId: string, createdAt = new Date().toISOString()) => {
    await pglite.query(
      'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [workId, 'Test Work Note', 'Content', createdAt, createdAt]
    );
  };

  beforeEach(async () => {
    await pgCleanupAll(pglite);
  });

  it('migrates a single R2 work note file to Google Drive and updates DB', async () => {
    const workId = 'WORK-123';
    const fileId = 'FILE-1';
    const r2Key = `work-notes/${workId}/files/${fileId}`;
    const uploadedBy = 'tester@example.com';
    const now = new Date().toISOString();

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');

    await pglite.query(
      `INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name, file_type, file_size,
        uploaded_by, uploaded_at, storage_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileId, workId, r2Key, 'report.pdf', 'application/pdf', 8, uploadedBy, now, 'R2']
    );

    const r2 = new MockR2();
    await r2.put(r2Key, new Blob(['PDF DATA'], { type: 'application/pdf' }), {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const drive = {
      getOrCreateWorkNoteFolder: vi.fn(async (_email: string, targetWorkId: string) => {
        await pglite.query(
          `INSERT INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
           VALUES ($1, $2, $3, $4)`,
          [targetWorkId, 'FOLDER-1', 'https://drive.example/folder', now]
        );

        return {
          workId: targetWorkId,
          gdriveFolderId: 'FOLDER-1',
          gdriveFolderLink: 'https://drive.example/folder',
          createdAt: now,
        };
      }),
      uploadFile: vi.fn().mockResolvedValue({
        id: 'GFILE-1',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.example/file',
        size: '8',
      }),
    };

    const migrated = await migrateR2WorkNoteFiles({
      db: getDb(),
      r2: r2 as unknown as R2Bucket,
      drive,
      userEmail: uploadedBy,
    });

    expect(migrated).toBe(1);
    expect(drive.getOrCreateWorkNoteFolder).toHaveBeenCalledWith(uploadedBy, workId);
    expect(drive.uploadFile).toHaveBeenCalledTimes(1);

    const fileRow =
      (
        await pglite.query<Record<string, unknown>>(
          'SELECT storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link FROM work_note_files WHERE file_id = $1',
          [fileId]
        )
      ).rows[0] ?? null;

    expect(fileRow).toEqual({
      storage_type: 'GDRIVE',
      gdrive_file_id: 'GFILE-1',
      gdrive_folder_id: 'FOLDER-1',
      gdrive_web_view_link: 'https://drive.example/file',
    });

    const folderRow =
      (
        await pglite.query<Record<string, unknown>>(
          'SELECT gdrive_folder_id, gdrive_folder_link FROM work_note_gdrive_folders WHERE work_id = $1',
          [workId]
        )
      ).rows[0] ?? null;

    expect(folderRow).toEqual({
      gdrive_folder_id: 'FOLDER-1',
      gdrive_folder_link: 'https://drive.example/folder',
    });
  });

  it('uses existing folder records without creating a new Drive folder', async () => {
    const workId = 'WORK-456';
    const fileId = 'FILE-2';
    const r2Key = `work-notes/${workId}/files/${fileId}`;
    const uploadedBy = 'tester@example.com';
    const now = new Date().toISOString();

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');
    await pglite.query(
      `INSERT INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
       VALUES ($1, $2, $3, $4)`,
      [workId, 'FOLDER-EXISTING', 'https://drive.example/existing', now]
    );

    await pglite.query(
      `INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name, file_type, file_size,
        uploaded_by, uploaded_at, storage_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileId, workId, r2Key, 'notes.pdf', 'application/pdf', 4, uploadedBy, now, 'R2']
    );

    const r2 = new MockR2();
    await r2.put(r2Key, new Blob(['DATA'], { type: 'application/pdf' }), {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const drive = {
      getOrCreateWorkNoteFolder: vi.fn(async (_email: string, targetWorkId: string) => {
        const existing =
          (
            await pglite.query<Record<string, string>>(
              'SELECT gdrive_folder_id, gdrive_folder_link FROM work_note_gdrive_folders WHERE work_id = $1',
              [targetWorkId]
            )
          ).rows[0] ?? null;

        if (existing) {
          return {
            workId: targetWorkId,
            gdriveFolderId: existing.gdrive_folder_id,
            gdriveFolderLink: existing.gdrive_folder_link,
            createdAt: now,
          };
        }

        return {
          workId: targetWorkId,
          gdriveFolderId: 'FOLDER-SHOULD-NOT-USE',
          gdriveFolderLink: 'https://drive.example/new',
          createdAt: now,
        };
      }),
      uploadFile: vi.fn().mockResolvedValue({
        id: 'GFILE-2',
        name: 'notes.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.example/file2',
        size: '4',
      }),
    };

    const migrated = await migrateR2WorkNoteFiles({
      db: getDb(),
      r2: r2 as unknown as R2Bucket,
      drive,
      userEmail: uploadedBy,
    });

    expect(migrated).toBe(1);
    expect(drive.getOrCreateWorkNoteFolder).toHaveBeenCalledWith(uploadedBy, workId);
    expect(drive.uploadFile).toHaveBeenCalledWith(
      uploadedBy,
      'FOLDER-EXISTING',
      expect.any(Blob),
      'notes.pdf',
      'application/pdf'
    );

    const fileRow =
      (
        await pglite.query<Record<string, unknown>>(
          'SELECT storage_type, gdrive_folder_id FROM work_note_files WHERE file_id = $1',
          [fileId]
        )
      ).rows[0] ?? null;

    expect(fileRow).toEqual({
      storage_type: 'GDRIVE',
      gdrive_folder_id: 'FOLDER-EXISTING',
    });
  });

  it('skips files when the R2 object is missing', async () => {
    const workId = 'WORK-789';
    const fileId = 'FILE-3';
    const r2Key = `work-notes/${workId}/files/${fileId}`;
    const uploadedBy = 'tester@example.com';
    const now = new Date().toISOString();

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');
    await pglite.query(
      `INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name, file_type, file_size,
        uploaded_by, uploaded_at, storage_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileId, workId, r2Key, 'missing.pdf', 'application/pdf', 0, uploadedBy, now, 'R2']
    );

    const r2 = new MockR2();

    const drive = {
      getOrCreateWorkNoteFolder: vi.fn().mockResolvedValue({
        workId,
        gdriveFolderId: 'FOLDER-MISSING',
        gdriveFolderLink: 'https://drive.example/missing',
        createdAt: now,
      }),
      uploadFile: vi.fn(),
    };

    const migrated = await migrateR2WorkNoteFiles({
      db: getDb(),
      r2: r2 as unknown as R2Bucket,
      drive,
      userEmail: uploadedBy,
    });

    expect(migrated).toBe(0);
    expect(drive.uploadFile).not.toHaveBeenCalled();

    const fileRow =
      (
        await pglite.query<Record<string, unknown>>(
          'SELECT storage_type, gdrive_file_id FROM work_note_files WHERE file_id = $1',
          [fileId]
        )
      ).rows[0] ?? null;

    expect(fileRow).toEqual({
      storage_type: 'R2',
      gdrive_file_id: null,
    });
  });

  it('does not create Drive folders when all R2 objects are missing', async () => {
    const workId = 'WORK-890';
    const fileId = 'FILE-4';
    const r2Key = `work-notes/${workId}/files/${fileId}`;
    const uploadedBy = 'tester@example.com';
    const now = new Date().toISOString();

    await insertWorkNote(workId, '2023-05-01T00:00:00.000Z');
    await pglite.query(
      `INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name, file_type, file_size,
        uploaded_by, uploaded_at, storage_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileId, workId, r2Key, 'missing.pdf', 'application/pdf', 0, uploadedBy, now, 'R2']
    );

    const r2 = new MockR2();
    const drive = {
      getOrCreateWorkNoteFolder: vi.fn(),
      uploadFile: vi.fn(),
    };

    const migrated = await migrateR2WorkNoteFiles({
      db: getDb(),
      r2: r2 as unknown as R2Bucket,
      drive,
      userEmail: uploadedBy,
    });

    expect(migrated).toBe(0);
    expect(drive.getOrCreateWorkNoteFolder).not.toHaveBeenCalled();
  });
});

describe('runMigrationCli', () => {
  it('wires CLI flags into migration options', async () => {
    const db = {} as DatabaseClient;
    const r2 = new MockR2() as unknown as R2Bucket;
    const envBindings = {
      GOOGLE_CLIENT_ID: 'id',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;
    const drive = {
      getOrCreateWorkNoteFolder: vi.fn(),
      uploadFile: vi.fn(),
    };
    const migrate = vi.fn().mockResolvedValue(2);
    const createBindings = vi.fn().mockResolvedValue({ env: envBindings, db, r2 });
    const driveFactory = vi.fn().mockReturnValue(drive);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = await runMigrationCli(['--user-email', 'cli@example.com', '--delete-r2'], {
      createBindings,
      driveFactory,
      migrate,
      logger,
    });

    expect(exitCode).toBe(0);
    expect(createBindings).toHaveBeenCalledTimes(1);
    expect(driveFactory).toHaveBeenCalledWith(envBindings, db);
    expect(migrate).toHaveBeenCalledWith({
      db,
      r2,
      drive,
      userEmail: 'cli@example.com',
      deleteR2: true,
      logger,
    });
  });
});
