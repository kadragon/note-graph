import type { D1Database, R2Bucket, R2ObjectBody } from '@cloudflare/workers-types';

type Logger = Pick<Console, 'info' | 'warn' | 'error'>;

interface DriveFolderRecord {
  workId: string;
  gdriveFolderId: string;
  gdriveFolderLink: string;
  createdAt: string;
}

interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string;
}

export interface DriveClient {
  getOrCreateWorkNoteFolder(userEmail: string, workId: string): Promise<DriveFolderRecord>;
  uploadFile(
    userEmail: string,
    folderId: string,
    file: Blob,
    fileName: string,
    mimeType: string
  ): Promise<DriveFileRecord>;
}

interface MigrationOptions {
  db: D1Database;
  r2: R2Bucket;
  drive: DriveClient;
  userEmail: string;
  deleteR2?: boolean;
  logger?: Logger;
}

interface WorkNoteFileRow {
  file_id: string;
  work_id: string;
  r2_key: string | null;
  original_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
}

interface GDriveFolderRow {
  gdrive_folder_id: string;
  gdrive_folder_link: string;
}

const DEFAULT_LOGGER: Logger = console;

export async function migrateR2WorkNoteFiles(options: MigrationOptions): Promise<number> {
  const { db, r2, drive, userEmail, deleteR2 = false, logger = DEFAULT_LOGGER } = options;

  const filesResult = await db
    .prepare(
      `SELECT file_id, work_id, r2_key, original_name, file_type, file_size, uploaded_by
       FROM work_note_files
       WHERE storage_type = 'R2' AND deleted_at IS NULL`
    )
    .all<WorkNoteFileRow>();

  const files = filesResult.results ?? [];
  if (files.length === 0) {
    logger.info('No R2 files to migrate.');
    return 0;
  }

  const grouped = new Map<string, WorkNoteFileRow[]>();
  for (const file of files) {
    const group = grouped.get(file.work_id);
    if (group) {
      group.push(file);
    } else {
      grouped.set(file.work_id, [file]);
    }
  }

  let migratedCount = 0;

  for (const [workId, group] of grouped) {
    const folder = await ensureWorkNoteFolder({ db, drive, userEmail, workId });

    for (const file of group) {
      if (!file.r2_key) {
        logger.warn(`Skipping file ${file.file_id}: missing r2_key.`);
        continue;
      }

      const object = await r2.get(file.r2_key);
      if (!object) {
        logger.warn(`Skipping file ${file.file_id}: R2 object not found.`);
        continue;
      }

      const blob = await r2ObjectToBlob(object, file.file_type);
      const uploaded = await drive.uploadFile(
        userEmail,
        folder.gdriveFolderId,
        blob,
        file.original_name,
        file.file_type
      );

      await db
        .prepare(
          `UPDATE work_note_files
           SET storage_type = 'GDRIVE',
               gdrive_file_id = ?,
               gdrive_folder_id = ?,
               gdrive_web_view_link = ?
           WHERE file_id = ?`
        )
        .bind(uploaded.id, folder.gdriveFolderId, uploaded.webViewLink, file.file_id)
        .run();

      if (deleteR2) {
        await r2.delete(file.r2_key);
      }

      migratedCount += 1;
    }
  }

  return migratedCount;
}

async function ensureWorkNoteFolder(params: {
  db: D1Database;
  drive: DriveClient;
  userEmail: string;
  workId: string;
}): Promise<DriveFolderRecord> {
  const { db, drive, userEmail, workId } = params;

  const existing = await db
    .prepare(
      `SELECT gdrive_folder_id, gdrive_folder_link
       FROM work_note_gdrive_folders
       WHERE work_id = ?`
    )
    .bind(workId)
    .first<GDriveFolderRow>();

  if (existing) {
    return {
      workId,
      gdriveFolderId: existing.gdrive_folder_id,
      gdriveFolderLink: existing.gdrive_folder_link,
      createdAt: new Date().toISOString(),
    };
  }

  const folder = await drive.getOrCreateWorkNoteFolder(userEmail, workId);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT OR IGNORE INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(workId, folder.gdriveFolderId, folder.gdriveFolderLink, now)
    .run();

  return {
    ...folder,
    createdAt: folder.createdAt ?? now,
  };
}

async function r2ObjectToBlob(object: R2ObjectBody, fallbackType: string): Promise<Blob> {
  const buffer = await new Response(object.body).arrayBuffer();
  const contentType =
    object.httpMetadata?.contentType || fallbackType || 'application/octet-stream';
  return new Blob([buffer], { type: contentType });
}
