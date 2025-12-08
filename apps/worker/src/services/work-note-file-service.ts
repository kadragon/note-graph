// Trace: SPEC-worknote-attachments-1, TASK-057, TASK-058
/**
 * Service for managing work note file uploads and R2 storage
 * Note: No automatic text extraction or embedding (unlike project files)
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { WorkNoteFile } from '@shared/types/work-note';
import { nanoid } from 'nanoid';
import { BadRequestError, NotFoundError } from '../types/errors';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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

const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];
const UNSUPPORTED_FILE_MESSAGE =
  '지원하지 않는 파일 형식입니다. 허용된 형식: PDF, HWP/HWPX, Excel (XLS/XLSX), 이미지 (PNG, JPEG, GIF, WebP)';

function resolveFileType(originalName: string, mimeType: string): string {
  let normalizedMime = (mimeType || '').trim().toLowerCase();
  if (normalizedMime === 'image/jpg') {
    normalizedMime = 'image/jpeg';
  }
  const extension = originalName.toLowerCase().split('.').pop();

  if (normalizedMime && ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return normalizedMime;
  }

  if (normalizedMime && !GENERIC_MIME_TYPES.includes(normalizedMime)) {
    throw new BadRequestError(UNSUPPORTED_FILE_MESSAGE);
  }

  if (extension && EXTENSION_MIME_MAP[extension]) {
    return EXTENSION_MIME_MAP[extension];
  }

  throw new BadRequestError(UNSUPPORTED_FILE_MESSAGE);
}

interface UploadFileParams {
  workId: string;
  file: Blob;
  originalName: string;
  uploadedBy: string;
}

export class WorkNoteFileService {
  constructor(
    private r2: R2Bucket,
    private db: D1Database
  ) {}

  /**
   * Upload file to R2 and create DB record
   * No automatic text extraction or embedding (simple attachment only)
   */
  async uploadFile(params: UploadFileParams): Promise<WorkNoteFile> {
    const { workId, file, originalName, uploadedBy } = params;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `파일 크기가 제한을 초과했습니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 업로드 가능합니다.`
      );
    }

    // Validate type (MIME or extension) and resolve canonical MIME type
    const resolvedFileType = resolveFileType(originalName, file.type);

    // Generate file ID and R2 key
    const fileId = `FILE-${nanoid()}`;
    const r2Key = `work-notes/${workId}/files/${fileId}`;
    const now = new Date().toISOString();

    // Upload to R2
    await this.r2.put(r2Key, file, {
      httpMetadata: {
        contentType: resolvedFileType,
      },
      customMetadata: {
        originalName,
        uploadedBy,
        workId,
        fileId,
      },
    });

    // Create DB record
    await this.db
      .prepare(
        `
      INSERT INTO work_note_files (
        file_id, work_id, r2_key, original_name,
        file_type, file_size, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(fileId, workId, r2Key, originalName, resolvedFileType, file.size, uploadedBy, now)
      .run();

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
   * Get file metadata by ID
   */
  async getFileById(fileId: string): Promise<WorkNoteFile | null> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM work_note_files
      WHERE file_id = ? AND deleted_at IS NULL
    `
      )
      .bind(fileId)
      .first<Record<string, unknown>>();

    if (!result) return null;

    return this.mapDbToFile(result);
  }

  /**
   * List all files for a work note
   */
  async listFiles(workId: string): Promise<WorkNoteFile[]> {
    const results = await this.db
      .prepare(
        `
      SELECT * FROM work_note_files
      WHERE work_id = ? AND deleted_at IS NULL
      ORDER BY uploaded_at DESC
    `
      )
      .bind(workId)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => this.mapDbToFile(r));
  }

  /**
   * Stream file content from R2
   */
  async streamFile(fileId: string): Promise<{ body: ReadableStream; headers: Headers }> {
    const file = await this.getFileById(fileId);
    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    const object = await this.r2.get(file.r2Key);
    if (!object) {
      throw new NotFoundError('File in R2', file.r2Key);
    }

    const headers = new Headers();
    headers.set('Content-Type', file.fileType);
    headers.set('Content-Length', file.fileSize.toString());
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`
    );

    return {
      body: object.body,
      headers,
    };
  }

  /**
   * Delete file from R2 and mark as deleted in DB
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = await this.getFileById(fileId);
    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    // Soft delete in DB
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `
      UPDATE work_note_files
      SET deleted_at = ?
      WHERE file_id = ?
    `
      )
      .bind(now, fileId)
      .run();

    // Delete from R2
    await this.r2.delete(file.r2Key);
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
  private mapDbToFile(row: Record<string, unknown>): WorkNoteFile {
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
