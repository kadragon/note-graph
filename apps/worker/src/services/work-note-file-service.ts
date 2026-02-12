// Trace: SPEC-worknote-attachments-1, SPEC-refactor-file-service, TASK-057, TASK-058, TASK-066, TASK-REFACTOR-003
/**
 * Service for managing work note file uploads and Google Drive storage
 * Note: No automatic text extraction or embedding
 */

import type {
  DriveFileListItem,
  WorkNoteFile,
  WorkNoteFileMigrationResult,
  WorkNoteFileStorageType,
  WorkNoteFilesListResponse,
} from '@shared/types/work-note';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env';
import { DomainError } from '../types/errors';
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
  'application/vnd.hancom.hwp', // HWP (another common MIME type)
  'application/vnd.hancom.hwpx', // HWP 2014+
  'application/hwp+zip', // HWPX (Hancom forum guidance)
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

const DRIVE_APP_PROPERTY_FILE_ID = 'workNoteFileId';

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

  constructor(r2: R2Bucket, db: D1Database, env?: Env) {
    super(r2, db);
    if (env?.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GDRIVE_ROOT_FOLDER_ID) {
      this.driveService = new GoogleDriveService(env, db);
    } else {
      this.driveService = null;
    }
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

    const driveService = this.requireDriveService();

    // Get or create Google Drive folder for this work note
    const folder = await driveService.getOrCreateWorkNoteFolder(uploadedBy, workId);

    // Upload to Google Drive
    const driveFile = await driveService.uploadFile(
      uploadedBy,
      folder.gdriveFolderId,
      file,
      originalName,
      resolvedFileType,
      {
        [DRIVE_APP_PROPERTY_FILE_ID]: fileId,
        workId,
      }
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

  /**
   * Delete file from storage (R2 or Google Drive) and mark as deleted in DB
   */
  async deleteFile(fileId: string, userEmail?: string): Promise<void> {
    const file = await this.requireFile(fileId);

    await this.softDeleteFileRecord(fileId);

    // Delete from appropriate storage
    if (file.storageType === 'GDRIVE' && file.gdriveFileId && userEmail) {
      const driveService = this.requireDriveService();
      await driveService.deleteFile(userEmail, file.gdriveFileId);
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
    const folderId = userEmail
      ? ((
          await this.db
            .prepare(`SELECT gdrive_folder_id FROM work_note_gdrive_folders WHERE work_id = ?`)
            .bind(workId)
            .first<{ gdrive_folder_id: string }>()
        )?.gdrive_folder_id ?? null)
      : null;
    const shouldDeleteDriveFiles = !!(userEmail && !folderId);

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
          if (row.storage_type === 'GDRIVE') {
            if (shouldDeleteDriveFiles && row.gdrive_file_id && this.driveService && userEmail) {
              await this.driveService.deleteFile(userEmail, row.gdrive_file_id);
            }
            return;
          }

          if (row.r2_key) {
            await this.r2.delete(row.r2_key);
          }
        } catch (error) {
          console.error(`Failed to delete file ${row.file_id}:`, error);
          // Non-fatal: continue with other files
        }
      })
    );

    // Also delete the Google Drive folder if it exists
    if (userEmail && folderId && this.driveService) {
      try {
        await this.driveService.deleteFolder(userEmail, folderId);
      } catch (error) {
        console.error(`Failed to delete Google Drive folder for work note ${workId}:`, error);
        // Non-fatal
      }
    }
  }

  private async updateFileToDriveRecord(
    fileId: string,
    folderId: string,
    driveFile: { id: string; webViewLink: string }
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE work_note_files
         SET storage_type = ?, gdrive_file_id = ?, gdrive_folder_id = ?, gdrive_web_view_link = ?
         WHERE file_id = ?`
      )
      .bind('GDRIVE', driveFile.id, folderId, driveFile.webViewLink, fileId)
      .run();
  }

  /**
   * Migrate all legacy R2 files for a work note to Google Drive
   */
  async migrateR2FilesToDrive(
    workId: string,
    userEmail?: string
  ): Promise<WorkNoteFileMigrationResult> {
    if (!userEmail) {
      throw new DomainError('사용자 이메일이 필요합니다.', 'BAD_REQUEST', 400);
    }

    const driveService = this.requireDriveService();

    const files = await this.listFiles(workId);
    const r2Files = files.filter((file) => file.storageType === 'R2');

    if (r2Files.length === 0) {
      return { migrated: 0, skipped: 0, failed: 0 };
    }

    const folder = await driveService.getOrCreateWorkNoteFolder(userEmail, workId);
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of r2Files) {
      if (!file.r2Key) {
        skipped++;
        continue;
      }

      const object = await this.r2.get(file.r2Key);
      if (!object) {
        skipped++;
        continue;
      }

      let uploadedFile: { id: string; webViewLink: string } | null = null;

      try {
        const existingFile = await driveService.findFileByAppPropertyInFolder(
          userEmail,
          folder.gdriveFolderId,
          DRIVE_APP_PROPERTY_FILE_ID,
          file.fileId
        );
        if (existingFile) {
          await this.updateFileToDriveRecord(file.fileId, folder.gdriveFolderId, existingFile);
          await this.deleteR2Object(file.r2Key);
          migrated++;
          continue;
        }

        const buffer = await object.arrayBuffer();
        const blob = new Blob([buffer], {
          type: file.fileType || 'application/octet-stream',
        });

        const driveFile = await driveService.uploadFile(
          userEmail,
          folder.gdriveFolderId,
          blob,
          file.originalName,
          file.fileType || 'application/octet-stream',
          {
            [DRIVE_APP_PROPERTY_FILE_ID]: file.fileId,
            workId,
          }
        );
        uploadedFile = driveFile;

        await this.updateFileToDriveRecord(file.fileId, folder.gdriveFolderId, driveFile);

        await this.deleteR2Object(file.r2Key);
        migrated++;
      } catch (error) {
        failed++;
        console.error(`Failed to migrate file ${file.fileId} to Google Drive:`, error);
        if (uploadedFile) {
          try {
            await driveService.deleteFile(userEmail, uploadedFile.id);
          } catch (cleanupError) {
            console.error(
              `Failed to rollback Google Drive file ${uploadedFile.id} after migration error:`,
              cleanupError
            );
          }
        }
      }
    }

    return { migrated, skipped, failed };
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

  isDriveConfigured(): boolean {
    return !!this.driveService;
  }

  /**
   * Upload file to Google Drive without creating DB record
   * Uses Drive folder as source of truth - no individual file tracking
   * Returns DriveFileListItem format for consistency with folder listing
   */
  async uploadFileToDrive(params: UploadFileParams): Promise<DriveFileListItem> {
    const { workId, file, originalName, uploadedBy } = params;

    this.validateFileSize(file);

    const resolvedFileType = this.resolveFileType(originalName, file.type);
    const driveService = this.requireDriveService();

    // Get or create Google Drive folder for this work note
    const folder = await driveService.getOrCreateWorkNoteFolder(uploadedBy, workId);

    // Upload to Google Drive (no appProperties needed since we don't track in DB)
    const driveFile = await driveService.uploadFile(
      uploadedBy,
      folder.gdriveFolderId,
      file,
      originalName,
      resolvedFileType
    );

    // Return DriveFileListItem format
    return {
      id: driveFile.id,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      webViewLink: driveFile.webViewLink,
      size: file.size,
      modifiedTime: new Date().toISOString(),
    };
  }

  /**
   * Delete file from Google Drive by Drive file ID
   * Does not require DB lookup - deletes directly from Drive
   */
  async deleteDriveFile(driveFileId: string, userEmail: string): Promise<void> {
    const driveService = this.requireDriveService();
    await driveService.deleteFile(userEmail, driveFileId);
  }

  /**
   * List files directly from Google Drive folder (source of truth)
   * Does not use DB tracking - queries Drive folder content directly
   */
  async listFilesFromDrive(workId: string, userEmail: string): Promise<WorkNoteFilesListResponse> {
    const googleDriveConfigured = this.isDriveConfigured();

    // Get existing Drive folder from DB (if any)
    const folderRecord = await this.db
      .prepare(
        `SELECT gdrive_folder_id as gdriveFolderId, gdrive_folder_link as gdriveFolderLink
         FROM work_note_gdrive_folders WHERE work_id = ?`
      )
      .bind(workId)
      .first<{ gdriveFolderId: string; gdriveFolderLink: string }>();

    // Check for legacy R2 files
    const legacyCount = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM work_note_files
         WHERE work_id = ? AND storage_type = 'R2' AND deleted_at IS NULL`
      )
      .bind(workId)
      .first<{ count: number }>();

    const hasLegacyFiles = (legacyCount?.count ?? 0) > 0;

    const normalizedFolderId = folderRecord?.gdriveFolderId?.trim() ?? '';
    const hasDriveFolderId = normalizedFolderId.length > 0;
    const driveFolderId = hasDriveFolderId ? normalizedFolderId : null;
    const driveFolderLink = hasDriveFolderId
      ? (folderRecord?.gdriveFolderLink?.trim() ?? null)
      : null;

    // If no Drive folder or Drive not configured, return empty list
    if (!driveFolderId || !googleDriveConfigured || !this.driveService) {
      return {
        files: [],
        driveFolderId,
        driveFolderLink,
        googleDriveConfigured,
        hasLegacyFiles,
      };
    }

    // List files from Drive folder
    const driveFiles = await this.driveService.listFilesInFolder(userEmail, driveFolderId);

    // Map to DriveFileListItem format (convert size from string to number)
    const files: DriveFileListItem[] = driveFiles.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink,
      size: parseInt(f.size, 10) || 0,
      modifiedTime: f.modifiedTime ?? new Date(0).toISOString(),
    }));

    return {
      files,
      driveFolderId,
      driveFolderLink,
      googleDriveConfigured,
      hasLegacyFiles,
    };
  }

  private requireDriveService(): GoogleDriveService {
    if (!this.driveService) {
      throw new DomainError(
        'Google OAuth 또는 Google Drive 환경 변수가 설정되어 있지 않습니다.',
        'CONFIGURATION_ERROR',
        500
      );
    }

    return this.driveService;
  }
}
