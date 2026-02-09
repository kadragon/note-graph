// Trace: SPEC-project-1, SPEC-refactor-file-service, TASK-039, TASK-042, TASK-REFACTOR-003, SPEC-refactor-embedding-service, TASK-REFACTOR-005
/**
 * Service for managing project file uploads and R2 storage
 * Includes automatic text extraction and embedding for supported file types
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { ProjectFile } from '@shared/types/project';
import type { TextChunk } from '@shared/types/search';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env';
import { DomainError, NotFoundError } from '../types/errors';
import { BaseFileService } from './base-file-service.js';
import { ChunkingService } from './chunking-service.js';
import { EmbeddingProcessor } from './embedding-processor.js';
import { FileTextExtractionService } from './file-text-extraction-service.js';
import { GoogleDriveService } from './google-drive-service.js';
import { VectorizeService } from './vectorize-service.js';

// Configuration
const MAX_FILES_PER_BATCH = 100; // Prevent timeout on large projects
const ALLOWED_MIME_TYPES = [
  // PDFs
  'application/pdf',
  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  // Office documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt
  // Text
  'text/plain',
  'text/markdown',
];

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain',
  md: 'text/markdown',
};

const UNSUPPORTED_FILE_MESSAGE =
  '지원하지 않는 파일 형식입니다. 허용된 형식: PDF, 이미지 (PNG, JPEG, GIF, WebP), Office 문서 (DOCX, XLSX, PPTX), 텍스트';
const DRIVE_APP_PROPERTY_FILE_ID = 'projectFileId';

interface UploadFileParams {
  projectId: string;
  file: Blob;
  originalName: string;
  uploadedBy: string;
}

interface ArchiveResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

interface ProjectFileMigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

export class ProjectFileService extends BaseFileService<ProjectFile> {
  private textExtractor: FileTextExtractionService;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;
  private embeddingProcessor: EmbeddingProcessor;
  private driveService: GoogleDriveService | null;

  constructor(env: Env, r2: R2Bucket, db: D1Database) {
    super(r2, db);
    this.textExtractor = new FileTextExtractionService();
    this.chunkingService = new ChunkingService();

    this.embeddingProcessor = new EmbeddingProcessor(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE);
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GDRIVE_ROOT_FOLDER_ID) {
      this.driveService = new GoogleDriveService(env, db);
    } else {
      this.driveService = null;
    }
  }

  protected tableName = 'project_files';
  protected ownerIdColumn = 'project_id';

  protected buildR2Key(projectId: string, fileId: string): string {
    return `projects/${projectId}/files/${fileId}`;
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
   * Automatically extracts text and creates embeddings for supported file types
   */
  async uploadFile(params: UploadFileParams): Promise<ProjectFile> {
    const { projectId, file, originalName, uploadedBy } = params;

    this.validateFileSize(file);

    const resolvedFileType = this.resolveFileType(originalName, file.type);
    const driveService = this.requireDriveService();

    // Generate file ID and R2 key
    const fileId = `FILE-${nanoid()}`;
    const generatedR2Key = this.buildR2Key(projectId, fileId);
    const now = new Date().toISOString();
    let storageType: 'R2' | 'GDRIVE' = 'R2';
    let gdriveFileId: string | null = null;
    let gdriveFolderId: string | null = null;
    let gdriveWebViewLink: string | null = null;

    try {
      const folder = await driveService.getOrCreateProjectFolder(uploadedBy, projectId);
      const driveFile = await driveService.uploadFile(
        uploadedBy,
        folder.gdriveFolderId,
        file,
        originalName,
        resolvedFileType,
        {
          [DRIVE_APP_PROPERTY_FILE_ID]: fileId,
          projectId,
        }
      );
      storageType = 'GDRIVE';
      gdriveFileId = driveFile.id;
      gdriveFolderId = folder.gdriveFolderId;
      gdriveWebViewLink = driveFile.webViewLink;
    } catch (error) {
      console.warn(
        `Project file ${fileId} Drive upload failed. Falling back to R2 storage.`,
        error
      );
    }

    const r2Key = storageType === 'R2' ? generatedR2Key : '';

    if (storageType === 'R2') {
      // Upload to R2 only for legacy storage path
      await this.putFileObject({
        r2Key,
        file,
        fileType: resolvedFileType,
        customMetadata: {
          originalName,
          uploadedBy,
          projectId,
          fileId,
        },
      });
    }

    // Create DB record
    await this.insertFileRecord({
      ownerId: projectId,
      fileId,
      r2Key,
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
      additionalColumns: {
        names: ['storage_type', 'gdrive_file_id', 'gdrive_folder_id', 'gdrive_web_view_link'],
        values: [storageType, gdriveFileId, gdriveFolderId, gdriveWebViewLink],
      },
    });

    const projectFile: ProjectFile = {
      fileId,
      projectId,
      r2Key,
      storageType,
      gdriveFileId,
      gdriveFolderId,
      gdriveWebViewLink,
      originalName,
      fileType: resolvedFileType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: now,
      embeddedAt: null,
      deletedAt: null,
    };

    // Extract text and create embeddings for supported file types
    // This is done synchronously to ensure embeddings are available immediately
    if (FileTextExtractionService.isTextExtractable(resolvedFileType)) {
      try {
        await this.embedFile(fileId, projectId, file, originalName, resolvedFileType);
        projectFile.embeddedAt = new Date().toISOString();
      } catch (error) {
        // Log error but don't fail the upload
        // File is still usable, just not searchable via RAG
        console.error(`Failed to embed file ${fileId}:`, error);
      }
    }

    return projectFile;
  }

  /**
   * Generate download URL (via Workers route)
   * Note: R2 doesn't support presigned URLs like S3, so we use a Workers route
   */
  async getDownloadUrl(fileId: string): Promise<string> {
    const file = await this.db
      .prepare(
        `
      SELECT project_id as projectId, r2_key as r2Key, storage_type as storageType
      FROM project_files
      WHERE file_id = ? AND deleted_at IS NULL
    `
      )
      .bind(fileId)
      .first<{ projectId: string; r2Key: string; storageType: 'R2' | 'GDRIVE' | null }>();

    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    const storageType = file.storageType ?? 'R2';

    if (storageType === 'R2') {
      const object = await this.r2.get(file.r2Key);
      if (!object) {
        throw new NotFoundError('File in R2', file.r2Key);
      }
    }

    // Return a worker route that streams the file
    // Authentication is handled by the route middleware
    return `/api/projects/${file.projectId}/files/${fileId}/download`;
  }

  /**
   * Extract text from file and create embeddings
   *
   * @param fileId - File ID
   * @param projectId - Project ID
   * @param file - File blob
   * @param originalName - Original filename
   */
  private async embedFile(
    fileId: string,
    projectId: string,
    file: Blob,
    originalName: string,
    fileType: string
  ): Promise<void> {
    // Extract text
    const extractionResult = await this.textExtractor.extractText(file, fileType);

    if (!extractionResult.success) {
      console.warn(`Text extraction failed for ${fileId}: ${extractionResult.reason}`);
      return;
    }

    const text = extractionResult.text as string;

    // Create chunks with project metadata
    const chunks = this.chunkingService.chunkFileContent(fileId, originalName, text, {
      project_id: projectId,
    });

    if (chunks.length === 0) {
      console.warn(`No chunks created for file ${fileId}`);
      return;
    }

    // Embed chunks into Vectorize
    await this.upsertFileChunks(fileId, chunks);

    // Update embedded_at timestamp
    await this.updateEmbeddedAt(fileId);

    // console.log(`Successfully embedded ${chunks.length} chunks for file ${fileId}`);
  }

  /**
   * Update embedded_at timestamp
   */
  private async updateEmbeddedAt(fileId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `
      UPDATE project_files
      SET embedded_at = ?
      WHERE file_id = ?
    `
      )
      .bind(now, fileId)
      .run();
  }

  /**
   * Upsert file chunks into Vectorize with embeddings
   * Uses centralized EmbeddingProcessor for consistency
   */
  private async upsertFileChunks(fileId: string, chunks: TextChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    // Convert TextChunk[] to the format expected by EmbeddingProcessor
    const chunksToEmbed = chunks.map((chunk) => ({
      id: ChunkingService.generateChunkId(fileId, chunk.metadata.chunk_index),
      text: chunk.text,
      metadata: chunk.metadata,
    }));

    // Use centralized embedding logic
    await this.embeddingProcessor.upsertChunks(chunksToEmbed);
  }

  /**
   * Delete all chunks for a file from Vectorize
   */
  private async deleteFileChunks(fileId: string): Promise<void> {
    try {
      const results = await this.vectorizeService.query(new Array(1536).fill(0), {
        topK: 500,
        filter: { work_id: fileId, scope: 'FILE' },
        returnMetadata: false,
      });

      if (results.matches.length > 0) {
        const chunkIds = results.matches.map((match) => match.id);
        await this.vectorizeService.delete(chunkIds);
      }
    } catch (error) {
      console.error('Error deleting file chunks:', error);
      // Non-fatal: log and continue
    }
  }

  /**
   * Delete file from R2 and mark as deleted in DB
   * Also removes embeddings from Vectorize if file was embedded
   */
  async deleteFile(fileId: string, userEmail?: string): Promise<void> {
    const file = await this.db
      .prepare(
        `
      SELECT file_id as fileId, r2_key as r2Key, embedded_at as embeddedAt,
             storage_type as storageType, gdrive_file_id as gdriveFileId
      FROM project_files
      WHERE file_id = ? AND deleted_at IS NULL
    `
      )
      .bind(fileId)
      .first<{
        fileId: string;
        r2Key: string;
        embeddedAt: string | null;
        storageType: 'R2' | 'GDRIVE' | null;
        gdriveFileId: string | null;
      }>();

    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    const storageType = file.storageType ?? 'R2';
    if (storageType === 'GDRIVE') {
      if (!userEmail) {
        throw new DomainError(
          'userEmail is required to delete a Google Drive file.',
          'BAD_REQUEST',
          400
        );
      }

      if (file.gdriveFileId) {
        const driveService = this.requireDriveService();
        await driveService.deleteFile(userEmail, file.gdriveFileId);
      }
    } else if (file.r2Key) {
      // Delete from R2 (or move to archive - for now just delete)
      await this.deleteR2Object(file.r2Key);
    }

    await this.softDeleteFileRecord(fileId);

    // Delete embeddings from Vectorize if file was embedded
    if (file.embeddedAt) {
      try {
        await this.deleteFileChunks(fileId);
      } catch (error) {
        console.error(`Failed to delete embeddings for file ${fileId}:`, error);
        // Non-fatal: log and continue
      }
    }
  }

  /**
   * Archive all active files for a project (used during project deletion)
   *
   * Moves objects to archive prefix, soft-deletes DB records, and removes embeddings.
   * Returns a summary of successful and failed archival operations.
   *
   * @param projectId - Project ID to archive files for
   * @returns ArchiveResult with lists of succeeded and failed file IDs
   * @throws BadRequestError if file count exceeds batch limit
   */
  async archiveProjectFiles(projectId: string, userEmail?: string): Promise<ArchiveResult> {
    // Select only necessary columns for better performance
    const files = await this.db
      .prepare(
        `
      SELECT file_id, r2_key, embedded_at FROM project_files
      WHERE project_id = ? AND deleted_at IS NULL
    `
      )
      .bind(projectId)
      .all<Record<string, unknown>>();

    if (!files.results || files.results.length === 0) {
      await this.deleteProjectDriveFolder(projectId, userEmail);
      return { succeeded: [], failed: [] };
    }

    // Performance safeguard: warn if file count is very large
    if (files.results.length > MAX_FILES_PER_BATCH) {
      console.warn(
        `Project ${projectId} has ${files.results.length} files (max recommended: ${MAX_FILES_PER_BATCH}). ` +
          `Archival may take longer than expected.`
      );
    }

    const now = new Date().toISOString();

    // Process files in parallel using Promise.allSettled for better performance
    // and to handle partial failures gracefully
    const archivePromises = files.results.map(async (row) => {
      const fileId = row.file_id as string;
      const currentKey = row.r2_key as string;
      // Construct archive key explicitly from components (more robust than string replace)
      const archiveKey = `projects/${projectId}/archive/${fileId}`;

      try {
        // Move object to archive prefix if it exists
        const object = await this.r2.get(currentKey);
        if (object) {
          // Type-safe metadata extraction
          const metadata = this.extractR2Metadata(object);
          await this.r2.put(archiveKey, object.body, metadata);
          await this.r2.delete(currentKey);
        }

        // Soft delete DB record and point to archive key for traceability
        await this.db
          .prepare(
            `
          UPDATE project_files
          SET deleted_at = ?, r2_key = ?
          WHERE file_id = ?
        `
          )
          .bind(now, archiveKey, fileId)
          .run();

        // Clean up embeddings if present
        if (row.embedded_at) {
          try {
            await this.deleteFileChunks(fileId);
          } catch (error) {
            console.error(`Failed to delete embeddings for archived file ${fileId}:`, error);
            // Non-fatal: continue with archival
          }
        }

        return { fileId, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to archive file ${fileId}:`, error);
        return { fileId, success: false, error: errorMessage };
      }
    });

    // Wait for all archival operations to complete
    const results = await Promise.allSettled(archivePromises);

    // Collect succeeded and failed file IDs
    const archiveResult: ArchiveResult = {
      succeeded: [],
      failed: [],
    };

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          archiveResult.succeeded.push(result.value.fileId);
        } else {
          archiveResult.failed.push({
            fileId: result.value.fileId,
            error: result.value.error || 'Unknown error',
          });
        }
      } else {
        // Promise itself rejected (shouldn't happen with our try-catch, but handle defensively)
        console.error('Unexpected promise rejection during archival:', result.reason);
      }
    });

    await this.deleteProjectDriveFolder(projectId, userEmail);

    return archiveResult;
  }

  private async updateFileToDriveRecord(
    fileId: string,
    folderId: string,
    driveFile: { id: string; webViewLink: string }
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE project_files
         SET storage_type = ?, gdrive_file_id = ?, gdrive_folder_id = ?, gdrive_web_view_link = ?
         WHERE file_id = ?`
      )
      .bind('GDRIVE', driveFile.id, folderId, driveFile.webViewLink, fileId)
      .run();
  }

  async migrateR2FilesToDrive(
    projectId: string,
    userEmail?: string
  ): Promise<ProjectFileMigrationResult> {
    if (!userEmail) {
      throw new DomainError('사용자 이메일이 필요합니다.', 'BAD_REQUEST', 400);
    }

    const driveService = this.requireDriveService();
    const folder = await driveService.getOrCreateProjectFolder(userEmail, projectId);

    const files = await this.db
      .prepare(
        `SELECT file_id as fileId, r2_key as r2Key, original_name as originalName, file_type as fileType
         FROM project_files
         WHERE project_id = ? AND deleted_at IS NULL AND COALESCE(storage_type, 'R2') = 'R2'`
      )
      .bind(projectId)
      .all<{
        fileId: string;
        r2Key: string;
        originalName: string;
        fileType: string;
      }>();

    if (!files.results || files.results.length === 0) {
      return { migrated: 0, skipped: 0, failed: 0 };
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files.results) {
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
            projectId,
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
   * Map database row to ProjectFile type
   */
  protected mapDbToFile(row: Record<string, unknown>): ProjectFile {
    const projectFile: ProjectFile = {
      fileId: row.file_id as string,
      projectId: row.project_id as string,
      r2Key: row.r2_key as string,
      storageType: (row.storage_type as string | null) === 'GDRIVE' ? 'GDRIVE' : 'R2',
      gdriveFileId: (row.gdrive_file_id as string | null) ?? null,
      gdriveFolderId: (row.gdrive_folder_id as string | null) ?? null,
      gdriveWebViewLink: (row.gdrive_web_view_link as string | null) ?? null,
      originalName: row.original_name as string,
      fileType: row.file_type as string,
      fileSize: row.file_size as number,
      uploadedBy: row.uploaded_by as string,
      uploadedAt: row.uploaded_at as string,
      embeddedAt: (row.embedded_at as string) || null,
      deletedAt: (row.deleted_at as string) || null,
    };

    return projectFile;
  }

  private async deleteProjectDriveFolder(projectId: string, userEmail?: string): Promise<void> {
    if (!userEmail || !this.driveService) {
      return;
    }

    const folderRecord = await this.db
      .prepare(
        `SELECT gdrive_folder_id, gdrive_folder_link, created_at
         FROM project_gdrive_folders
         WHERE project_id = ?`
      )
      .bind(projectId)
      .first<{
        gdrive_folder_id: string | null;
        gdrive_folder_link: string | null;
        created_at: string | null;
      }>();

    const folderId = folderRecord?.gdrive_folder_id?.trim();
    if (!folderId) {
      return;
    }

    try {
      await this.db
        .prepare(
          `DELETE FROM project_gdrive_folders
           WHERE project_id = ?`
        )
        .bind(projectId)
        .run();
    } catch (deleteMappingError) {
      console.error(
        `Failed to delete project_gdrive_folders mapping for project ${projectId}:`,
        deleteMappingError
      );
      return;
    }

    try {
      await this.driveService.deleteFolder(userEmail, folderId);
    } catch (driveDeleteError) {
      console.error(
        `Failed to delete Google Drive folder for project ${projectId}:`,
        driveDeleteError
      );
      try {
        await this.db
          .prepare(
            `INSERT OR REPLACE INTO project_gdrive_folders
             (project_id, gdrive_folder_id, gdrive_folder_link, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(
            projectId,
            folderId,
            folderRecord?.gdrive_folder_link ?? null,
            folderRecord?.created_at ?? new Date().toISOString()
          )
          .run();
      } catch (restoreError) {
        console.error(
          `Failed to restore project_gdrive_folders mapping after Drive delete failure for ${projectId}:`,
          restoreError
        );
      }
    }
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
