// Trace: SPEC-project-1, TASK-044
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../../src/types/env';
import type {
	R2Bucket,
	R2PutOptions,
	R2Object,
	R2ObjectBody,
	R2HTTPMetadata,
} from '@cloudflare/workers-types';
import type { ProjectFile } from '../../src/types/project';
import { ProjectFileService } from '../../src/services/project-file-service';
import { BadRequestError, NotFoundError } from '../../src/types/errors';

// Simple in-memory R2 mock
class MockR2Bucket implements R2Bucket {
	storage = new Map<string, { value: Blob; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> }>();

	async put(key: string, value: Blob, options?: R2PutOptions): Promise<R2Object | null> {
		this.storage.set(key, {
			value,
			httpMetadata: options?.httpMetadata,
			customMetadata: options?.customMetadata,
		});
		return null;
	}

	async get(key: string): Promise<R2ObjectBody | null> {
		const entry = this.storage.get(key);
		if (!entry) return null;

		return {
			body: entry.value.stream(),
			// Minimal fields used by service
			size: entry.value.size,
			writeHttpMetadata: () => {},
			httpEtag: '',
			httpMetadata: entry.httpMetadata ?? {},
			customMetadata: entry.customMetadata ?? {},
		} as unknown as R2ObjectBody;
	}

	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	// Unused methods for this test suite
	async head(): Promise<R2Object | null> {
		return null;
	}
}

describe('ProjectFileService', () => {
	const baseEnv = env as unknown as Env;
	let r2: MockR2Bucket;
	let service: ProjectFileService;
	let mockVectorize: { upsertFileChunks: ReturnType<typeof vi.fn>; deleteFileChunks: ReturnType<typeof vi.fn> };
	let mockTextExtractor: { extractText: ReturnType<typeof vi.fn> };

	const insertProject = async (projectId: string) => {
		const now = new Date().toISOString();
		await baseEnv.DB.prepare(
			`INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
		)
			.bind(projectId, '테스트 프로젝트', now, now)
			.run();
	};

	beforeEach(async () => {
		// Clean DB tables
		await baseEnv.DB.batch([
			baseEnv.DB.prepare('DELETE FROM project_files'),
			baseEnv.DB.prepare('DELETE FROM projects'),
		]);

		// Fresh mocks
		r2 = new MockR2Bucket();
		mockVectorize = {
			upsertFileChunks: vi.fn().mockResolvedValue(undefined),
			deleteFileChunks: vi.fn().mockResolvedValue(undefined),
		};
		mockTextExtractor = {
			extractText: vi.fn().mockResolvedValue({ success: true, text: '파일 내용입니다' }),
		};

		// Stub fetch used by EmbeddingService
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ embedding: new Array(1536).fill(0), index: 0 }],
			}),
		});

		service = new ProjectFileService(baseEnv, r2 as unknown as R2Bucket, baseEnv.DB);

		// Override internals for determinism
		(service as any).vectorizeService = mockVectorize;
		(service as any).textExtractor = mockTextExtractor;
	});

	it('uploads PDF, stores record, and embeds with project metadata', async () => {
		// Arrange
		await insertProject('PROJECT-123');
		const file = new Blob(['PDF content'], { type: 'application/pdf' });

		// Act
		const result = await service.uploadFile({
			projectId: 'PROJECT-123',
			file,
			originalName: 'spec.pdf',
			uploadedBy: 'tester@example.com',
		});

		// Assert - return value
		expect(result.projectId).toBe('PROJECT-123');
		expect(result.originalName).toBe('spec.pdf');
		expect(result.embeddedAt).not.toBeNull();

		// Assert - DB record exists
		const row = await baseEnv.DB.prepare('SELECT * FROM project_files WHERE file_id = ?')
			.bind(result.fileId)
			.first<Record<string, unknown>>();
		expect(row).toBeTruthy();

		// Assert - R2 stored at expected key
		expect(r2.storage.has(result.r2Key)).toBe(true);

		// Assert - Vectorize upsert called with project metadata
		expect(mockVectorize.upsertFileChunks).toHaveBeenCalledTimes(1);
		const chunksArg = mockVectorize.upsertFileChunks.mock.calls[0][1];
		expect(chunksArg[0].metadata.project_id).toBe('PROJECT-123');
	});

	it('rejects files exceeding 50MB limit', async () => {
		const oversized = { size: 51 * 1024 * 1024, type: 'application/pdf' } as unknown as Blob;

		await expect(
			service.uploadFile({
				projectId: 'PROJECT-1',
				file: oversized,
				originalName: 'big.pdf',
				uploadedBy: 'tester@example.com',
			})
		).rejects.toBeInstanceOf(BadRequestError);
	});

	it('rejects unsupported mime types', async () => {
		const zipFile = new Blob(['dummy'], { type: 'application/zip' });

		await expect(
			service.uploadFile({
				projectId: 'PROJECT-1',
				file: zipFile,
				originalName: 'archive.zip',
				uploadedBy: 'tester@example.com',
			})
		).rejects.toBeInstanceOf(BadRequestError);
	});

	it('deletes file, marking DB and removing embeddings', async () => {
		// Arrange - seed DB and R2
		const now = new Date().toISOString();
		await insertProject('PROJECT-1');
		await baseEnv.DB.prepare(
			`INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, embedded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				'FILE-123',
				'PROJECT-1',
				'projects/PROJECT-1/files/FILE-123',
				'spec.pdf',
				'application/pdf',
				1024,
				'tester@example.com',
				now,
				now
			)
			.run();
		r2.storage.set('projects/PROJECT-1/files/FILE-123', { value: new Blob(['pdf']) });

		// Act
		await service.deleteFile('FILE-123');

		// Assert - DB soft delete
		const deleted = await baseEnv.DB.prepare('SELECT deleted_at FROM project_files WHERE file_id = ?')
			.bind('FILE-123')
			.first<{ deleted_at: string }>();
		expect(deleted?.deleted_at).toBeDefined();

		// Assert - R2 object removed
		expect(r2.storage.has('projects/PROJECT-1/files/FILE-123')).toBe(false);

		// Assert - embeddings deletion invoked
		expect(mockVectorize.deleteFileChunks).toHaveBeenCalledWith('FILE-123');
	});

	it('returns download URL and streams file with headers', async () => {
		// Arrange
		const now = new Date().toISOString();
		const fileId = 'FILE-789';
		await insertProject('PROJECT-9');
		await baseEnv.DB.prepare(
			`INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				fileId,
				'PROJECT-9',
				`projects/PROJECT-9/files/${fileId}`,
				'doc.pdf',
				'application/pdf',
				2048,
				'user@example.com',
				now
			)
			.run();
		r2.storage.set(`projects/PROJECT-9/files/${fileId}`, { value: new Blob(['hello'], { type: 'application/pdf' }) });

		// Act
		const url = await service.getDownloadUrl(fileId);
		const streamed = await service.streamFile(fileId);

		// Assert
		expect(url).toBe(`/api/projects/PROJECT-9/files/${fileId}/download`);
		expect(streamed.headers.get('Content-Type')).toBe('application/pdf');
		expect(streamed.headers.get('Content-Length')).toBe('2048');
	});

	it('lists project files with metadata', async () => {
		const now = new Date().toISOString();
		await insertProject('PROJECT-LIST');

		await baseEnv.DB.batch([
			baseEnv.DB.prepare(
				`INSERT INTO project_files (
					file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			).bind('FILE-1', 'PROJECT-LIST', 'projects/PROJECT-LIST/files/FILE-1', 'a.pdf', 'application/pdf', 100, 'u@example.com', now),
			baseEnv.DB.prepare(
				`INSERT INTO project_files (
					file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			).bind('FILE-2', 'PROJECT-LIST', 'projects/PROJECT-LIST/files/FILE-2', 'b.png', 'image/png', 200, 'u@example.com', now),
		]);

		const files = await service.listFiles('PROJECT-LIST');

		expect(files).toHaveLength(2);
		expect(files[0]).toMatchObject<Partial<ProjectFile>>({
			projectId: 'PROJECT-LIST',
			originalName: expect.any(String),
			fileType: expect.any(String),
			fileSize: expect.any(Number),
		});
	});

	it('throws NotFoundError when streaming missing file', async () => {
		await expect(service.streamFile('MISSING')).rejects.toBeInstanceOf(NotFoundError);
	});
});
