// Trace: SPEC-project-1, TASK-039, TASK-042
/**
 * Service for managing project file uploads and R2 storage
 * Includes automatic text extraction and embedding for supported file types
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env';
import type { ProjectFile } from '../types/project';
import { BadRequestError, NotFoundError } from '../types/errors';
import { FileTextExtractionService } from './file-text-extraction-service.js';
import { ChunkingService } from './chunking-service.js';
import { EmbeddingService, VectorizeService } from './embedding-service.js';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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

interface UploadFileParams {
	projectId: string;
	file: Blob;
	originalName: string;
	uploadedBy: string;
}

export class ProjectFileService {
	private textExtractor: FileTextExtractionService;
	private chunkingService: ChunkingService;
	private vectorizeService: VectorizeService;

	constructor(
		env: Env,
		private r2: R2Bucket,
		private db: D1Database
	) {
		this.textExtractor = new FileTextExtractionService();
		this.chunkingService = new ChunkingService();

		const embeddingService = new EmbeddingService(env);
		this.vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);
	}

	/**
	 * Upload file to R2 and create DB record
	 * Automatically extracts text and creates embeddings for supported file types
	 */
	async uploadFile(params: UploadFileParams): Promise<ProjectFile> {
		const { projectId, file, originalName, uploadedBy } = params;

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			throw new BadRequestError(
				`파일 크기가 제한을 초과했습니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 업로드 가능합니다.`
			);
		}

		// Validate MIME type
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			throw new BadRequestError(
				`지원하지 않는 파일 형식입니다. 허용된 형식: PDF, 이미지 (PNG, JPEG, GIF, WebP), Office 문서 (DOCX, XLSX, PPTX), 텍스트`
			);
		}

		// Generate file ID and R2 key
		const fileId = `FILE-${nanoid()}`;
		const r2Key = `projects/${projectId}/files/${fileId}`;
		const now = new Date().toISOString();

		// Upload to R2
		await this.r2.put(r2Key, file, {
			httpMetadata: {
				contentType: file.type,
			},
			customMetadata: {
				originalName,
				uploadedBy,
				projectId,
				fileId,
			},
		});

		// Create DB record
		await this.db
			.prepare(
				`
      INSERT INTO project_files (
        file_id, project_id, r2_key, original_name,
        file_type, file_size, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
			)
			.bind(fileId, projectId, r2Key, originalName, file.type, file.size, uploadedBy, now)
			.run();

		const projectFile: ProjectFile = {
			fileId,
			projectId,
			r2Key,
			originalName,
			fileType: file.type,
			fileSize: file.size,
			uploadedBy,
			uploadedAt: now,
			embeddedAt: null,
			deletedAt: null,
		};

		// Extract text and create embeddings for supported file types
		// This is done synchronously to ensure embeddings are available immediately
		if (FileTextExtractionService.isTextExtractable(file.type)) {
			try {
				await this.embedFile(fileId, projectId, file, originalName);
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
	 * Get file metadata by ID
	 */
	async getFileById(fileId: string): Promise<ProjectFile | null> {
		const result = await this.db
			.prepare(
				`
      SELECT * FROM project_files
      WHERE file_id = ? AND deleted_at IS NULL
    `
			)
			.bind(fileId)
			.first<Record<string, unknown>>();

		if (!result) return null;

		return this.mapDbToFile(result);
	}

	/**
	 * List all files for a project
	 */
	async listFiles(projectId: string): Promise<ProjectFile[]> {
		const results = await this.db
			.prepare(
				`
      SELECT * FROM project_files
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY uploaded_at DESC
    `
			)
			.bind(projectId)
			.all<Record<string, unknown>>();

		return (results.results || []).map((r) => this.mapDbToFile(r));
	}

	/**
	 * Generate download URL (via Workers route)
	 * Note: R2 doesn't support presigned URLs like S3, so we use a Workers route
	 */
	async getDownloadUrl(fileId: string): Promise<string> {
		const file = await this.getFileById(fileId);
		if (!file) {
			throw new NotFoundError('File', fileId);
		}

		const object = await this.r2.get(file.r2Key);
		if (!object) {
			throw new NotFoundError('File in R2', file.r2Key);
		}

		// Return a worker route that streams the file
		// Authentication is handled by the route middleware
		return `/api/projects/${file.projectId}/files/${fileId}/download`;
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
		headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);

		return {
			body: object.body,
			headers,
		};
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
		originalName: string
	): Promise<void> {
		// Extract text
		const extractionResult = await this.textExtractor.extractText(file, file.type);

		if (!extractionResult.success) {
			console.warn(
				`Text extraction failed for ${fileId}: ${extractionResult.reason}`
			);
			return;
		}

		const text = extractionResult.text!;

		// Create chunks with project metadata
		const chunks = this.chunkingService.chunkFileContent(
			fileId,
			originalName,
			text,
			{
				project_id: projectId,
			}
		);

		if (chunks.length === 0) {
			console.warn(`No chunks created for file ${fileId}`);
			return;
		}

		// Embed chunks into Vectorize
		await this.vectorizeService.upsertFileChunks(fileId, chunks);

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
	 * Delete file from R2 and mark as deleted in DB
	 * Also removes embeddings from Vectorize if file was embedded
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
      UPDATE project_files
      SET deleted_at = ?
      WHERE file_id = ?
    `
			)
			.bind(now, fileId)
			.run();

		// Delete from R2 (or move to archive - for now just delete)
		await this.r2.delete(file.r2Key);

		// Delete embeddings from Vectorize if file was embedded
		if (file.embeddedAt) {
			try {
				await this.vectorizeService.deleteFileChunks(fileId);
			} catch (error) {
				console.error(`Failed to delete embeddings for file ${fileId}:`, error);
				// Non-fatal: log and continue
			}
		}
	}

	/**
	 * Map database row to ProjectFile type
	 */
	private mapDbToFile(row: Record<string, unknown>): ProjectFile {
		return {
			fileId: row.file_id as string,
			projectId: row.project_id as string,
			r2Key: row.r2_key as string,
			originalName: row.original_name as string,
			fileType: row.file_type as string,
			fileSize: row.file_size as number,
			uploadedBy: row.uploaded_by as string,
			uploadedAt: row.uploaded_at as string,
			embeddedAt: (row.embedded_at as string) || null,
			deletedAt: (row.deleted_at as string) || null,
		};
	}
}
