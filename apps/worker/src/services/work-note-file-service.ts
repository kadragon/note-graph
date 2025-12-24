// Trace: SPEC-worknote-attachments-1, SPEC-refactor-file-service, TASK-057, TASK-058, TASK-066, TASK-REFACTOR-003
/**
 * Service for managing work note file uploads and R2 storage
 * Note: No automatic text extraction or embedding (unlike project files)
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { WorkNoteFile } from '@shared/types/work-note';
import { nanoid } from 'nanoid';
import { BaseFileService } from './base-file-service.js';

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
  constructor(r2: R2Bucket, db: D1Database) {
    super(r2, db);
  }

  protected tableName = 'work_note_files';
  protected ownerIdColumn = 'work_id';

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
   * Upload file to R2 and create DB record
   * No automatic text extraction or embedding (simple attachment only)
   */
  async uploadFile(params: UploadFileParams): Promise<WorkNoteFile> {
    const { workId, file, originalName, uploadedBy } = params;

    this.validateFileSize(file);

    const resolvedFileType = this.resolveFileType(originalName, file.type);

    // Generate file ID and R2 key
    const fileId = `FILE-${nanoid()}`;
    const r2Key = this.buildR2Key(workId, fileId);
    const now = new Date().toISOString();

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
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
      deletedAt: null,
    };
  }

  /**
   * Delete file from R2 and mark as deleted in DB
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = await this.requireFile(fileId);

    await this.softDeleteFileRecord(fileId);
    await this.deleteR2Object(file.r2Key);
  }

  /**
   * Delete all files for a work note (used during work note deletion)
   * DB records are cleaned up by ON DELETE CASCADE when parent work_note is deleted.
   * This method only needs to delete R2 objects.
   */
  async deleteWorkNoteFiles(workId: string): Promise<void> {
    const files = await this.db
      .prepare(
        `
      SELECT file_id, r2_key FROM work_note_files
      WHERE work_id = ? AND deleted_at IS NULL
    `
      )
      .bind(workId)
      .all<{ file_id: string; r2_key: string }>();

    if (!files.results || files.results.length === 0) {
      return;
    }

    // Delete R2 objects in parallel. DB records will be cleaned up by ON DELETE CASCADE.
    await Promise.all(
      files.results.map(async (row) => {
        try {
          await this.r2.delete(row.r2_key);
        } catch (error) {
          console.error(`Failed to delete R2 object ${row.r2_key} for file ${row.file_id}:`, error);
          // Non-fatal: continue with other files
        }
      })
    );
  }

  /**
   * Map database row to WorkNoteFile type
   */
  protected mapDbToFile(row: Record<string, unknown>): WorkNoteFile {
    return {
      fileId: row.file_id as string,
      workId: row.work_id as string,
      r2Key: row.r2_key as string,
      originalName: row.original_name as string,
      fileType: row.file_type as string,
      fileSize: row.file_size as number,
      uploadedBy: row.uploaded_by as string,
      uploadedAt: row.uploaded_at as string,
      deletedAt: (row.deleted_at as string) || null,
    };
  }
}
