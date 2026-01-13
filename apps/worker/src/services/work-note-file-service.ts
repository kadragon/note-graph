// Trace: SPEC-worknote-attachments-1, SPEC-refactor-file-service, TASK-057, TASK-058, TASK-066, TASK-REFACTOR-003
/**
 * Service for managing work note file uploads and Google Drive storage
 * Note: No automatic text extraction or embedding (unlike project files)
 */

import type { WorkNoteFile, WorkNoteFileStorageType } from '@shared/types/work-note';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env';
import { BaseFileService } from './base-file-service.js';
import { GoogleDriveService } from './google-drive-service.js';

// Configuration
const ALLOWED_MIME_TYPES = [
  // PDFs
  'application/pdf',
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // HWP (Hancom Office)
  'application/x-hwp',
  'application/haansofthwp', // HWP 5.x
  'application/vnd.hancom.hwpx', // HWP 2014+
  // Excel
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  hwp: 'application/x-hwp',
  hwpx: 'application/vnd.hancom.hwpx',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const UNSUPPORTED_FILE_MESSAGE =
  '지원하지 않는 파일 형식입니다. 허용된 형식: PDF, HWP/HWPX, Excel (XLS/XLSX), 이미지 (PNG, JPEG, GIF, WebP)';

interface UploadFileParams {
  workId: string;
  file: Blob;
  originalName: string;
  uploadedBy: string;
}

export class WorkNoteFileService extends BaseFileService<WorkNoteFile> {
  protected tableName = 'work_note_files';
  protected ownerIdColumn = 'work_id';
  private driveService: GoogleDriveService | null;
  private useGoogleDrive: boolean;

  constructor(r2: R2Bucket, db: D1Database, env?: Env) {
    super(r2, db);
    // Only use Google Drive if OAuth credentials are configured
    this.useGoogleDrive = !!(env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET);
    this.driveService = this.useGoogleDrive && env ? new GoogleDriveService(env, db) : null;
  }

  protected buildR2Key(workId: string, fileId: string): string {
    return `work-notes/${workId}/files/${fileId}`;
  }

  protected getAllowedMimeTypes(): string[] {
    return ALLOWED_MIME_TYPES;
  }

  protected getExtensionMimeMap(): Record<string, string> {
    return EXTENSION_MIME_MAP;
  }

  protected getUnsupportedFileMessage(): string {
    return UNSUPPORTED_FILE_MESSAGE;
  }

  /**
   * Upload file to Google Drive (or R2 as fallback) and create DB record
   * No automatic text extraction or embedding (simple attachment only)
   */
  async uploadFile(params: UploadFileParams): Promise<WorkNoteFile> {
    const { workId, file, originalName, uploadedBy } = params;

    this.validateFileSize(file);

    const resolvedFileType = this.resolveFileType(originalName, file.type);

    // Generate file ID
    const fileId = `FILE-${nanoid()}`;
    const now = new Date().toISOString();

    // Use Google Drive if available, otherwise fallback to R2
    if (this.useGoogleDrive && this.driveService) {
      return this.uploadToGoogleDrive({
        workId,
        fileId,
        file,
        originalName,
        resolvedFileType,
        uploadedBy,
        now,
      });
    }

    // Fallback to R2 storage
    return this.uploadToR2({
      workId,
      fileId,
      file,
      originalName,
      resolvedFileType,
      uploadedBy,
      now,
    });
  }

  private async uploadToGoogleDrive(params: {
    workId: string;
    fileId: string;
    file: Blob;
    originalName: string;
    resolvedFileType: string;
    uploadedBy: string;
    now: string;
  }): Promise<WorkNoteFile> {
    const { workId, fileId, file, originalName, resolvedFileType, uploadedBy, now } = params;

    // Get or create Google Drive folder for this work note
    const folder = await this.driveService!.getOrCreateWorkNoteFolder(uploadedBy, workId);

    // Upload to Google Drive
    const driveFile = await this.driveService!.uploadFile(
      uploadedBy,
      folder.gdriveFolderId,
      file,
      originalName,
      resolvedFileType
    );

    // Create DB record with Google Drive info
    await this.db
      .prepare(
        `INSERT INTO work_note_files (
          file_id, work_id, r2_key, original_name, file_type, file_size,
          uploaded_by, uploaded_at, storage_type,
          gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fileId,
        workId,
        '', // r2_key is empty for Google Drive files
        originalName,
        resolvedFileType,
        file.size,
        uploadedBy,
        now,
        'GDRIVE',
        driveFile.id,
        folder.gdriveFolderId,
        driveFile.webViewLink
      )
      .run();

    return {
      fileId,
      workId,
      r2Key: undefined,
      gdriveFileId: driveFile.id,
      gdriveFolderId: folder.gdriveFolderId,
      gdriveWebViewLink: driveFile.webViewLink,
      storageType: 'GDRIVE',
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
      deletedAt: null,
    };
  }

  private async uploadToR2(params: {
    workId: string;
    fileId: string;
    file: Blob;
    originalName: string;
    resolvedFileType: string;
    uploadedBy: string;
    now: string;
  }): Promise<WorkNoteFile> {
    const { workId, fileId, file, originalName, resolvedFileType, uploadedBy, now } = params;
    const r2Key = this.buildR2Key(workId, fileId);

    // Upload to R2
    await this.putFileObject({
      r2Key,
      file,
      fileType: resolvedFileType,
      customMetadata: {
        originalName,
        uploadedBy,
        workId,
        fileId,
      },
    });

    // Create DB record
    await this.insertFileRecord({
      ownerId: workId,
      fileId,
      r2Key,
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
    });

    return {
      fileId,
      workId,
      r2Key,
      storageType: 'R2',
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
      deletedAt: null,
    };
  }

  /**
   * Delete file from storage (R2 or Google Drive) and mark as deleted in DB
   */
  async deleteFile(fileId: string, userEmail?: string): Promise<void> {
    const file = await this.requireFile(fileId);

    await this.softDeleteFileRecord(fileId);

    // Delete from appropriate storage
    if (file.storageType === 'GDRIVE' && file.gdriveFileId && this.driveService && userEmail) {
      await this.driveService.deleteFile(userEmail, file.gdriveFileId);
    } else if (file.r2Key) {
      await this.deleteR2Object(file.r2Key);
    }
  }

  /**
   * Delete all files for a work note (used during work note deletion)
   * DB records are cleaned up by ON DELETE CASCADE when parent work_note is deleted.
   * This method deletes storage objects (R2 or Google Drive).
   */
  async deleteWorkNoteFiles(workId: string, userEmail?: string): Promise<void> {
    const files = await this.db
      .prepare(
        `
      SELECT file_id, r2_key, storage_type, gdrive_file_id FROM work_note_files
      WHERE work_id = ? AND deleted_at IS NULL
    `
      )
      .bind(workId)
      .all<{
        file_id: string;
        r2_key: string;
        storage_type: WorkNoteFileStorageType;
        gdrive_file_id: string | null;
      }>();

    if (!files.results || files.results.length === 0) {
      return;
    }

    // Delete storage objects in parallel. DB records will be cleaned up by ON DELETE CASCADE.
    await Promise.all(
      files.results.map(async (row) => {
        try {
          if (
            row.storage_type === 'GDRIVE' &&
            row.gdrive_file_id &&
            this.driveService &&
            userEmail
          ) {
            await this.driveService.deleteFile(userEmail, row.gdrive_file_id);
          } else if (row.r2_key) {
            await this.r2.delete(row.r2_key);
          }
        } catch (error) {
          console.error(`Failed to delete file ${row.file_id}:`, error);
          // Non-fatal: continue with other files
        }
      })
    );

    // Also delete the Google Drive folder if it exists
    if (this.driveService && userEmail) {
      try {
        const folder = await this.db
          .prepare(`SELECT gdrive_folder_id FROM work_note_gdrive_folders WHERE work_id = ?`)
          .bind(workId)
          .first<{ gdrive_folder_id: string }>();

        if (folder) {
          await this.driveService.deleteFolder(userEmail, folder.gdrive_folder_id);
        }
      } catch (error) {
        console.error(`Failed to delete Google Drive folder for work note ${workId}:`, error);
        // Non-fatal
      }
    }
  }

  /**
   * Map database row to WorkNoteFile type
   */
  protected mapDbToFile(row: Record<string, unknown>): WorkNoteFile {
    const r2Key = row.r2_key as string;
    return {
      fileId: row.file_id as string,
      workId: row.work_id as string,
      r2Key: r2Key || undefined,
      gdriveFileId: (row.gdrive_file_id as string) || undefined,
      gdriveFolderId: (row.gdrive_folder_id as string) || undefined,
      gdriveWebViewLink: (row.gdrive_web_view_link as string) || undefined,
      storageType: (row.storage_type as WorkNoteFileStorageType) || 'R2',
      originalName: row.original_name as string,
      fileType: row.file_type as string,
      fileSize: row.file_size as number,
      uploadedBy: row.uploaded_by as string,
      uploadedAt: row.uploaded_at as string,
      deletedAt: (row.deleted_at as string) || null,
    };
  }
}
