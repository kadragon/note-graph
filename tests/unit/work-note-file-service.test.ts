// Trace: SPEC-worknote-attachments-1, TASK-057

import { env } from 'cloudflare:test';
import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from '@cloudflare/workers-types';
import type { WorkNoteFile } from '@shared/types/work-note';
import { WorkNoteFileService } from '@worker/services/work-note-file-service';
import type { Env } from '@worker/types/env';
import { BadRequestError, NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

// Simple in-memory R2 mock
class MockR2Bucket implements R2Bucket {
  storage = new Map<
    string,
    { value: Blob; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> }
  >();

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

describe('WorkNoteFileService', () => {
  const baseEnv = env as unknown as Env;
  let r2: MockR2Bucket;
  let service: WorkNoteFileService;

  const insertWorkNote = async (workId: string) => {
    const now = new Date().toISOString();
    await baseEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(workId, '테스트 업무노트', '내용', now, now)
      .run();
  };

  beforeEach(async () => {
    // Clean DB tables
    await baseEnv.DB.batch([
      baseEnv.DB.prepare('DELETE FROM work_note_files'),
      baseEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    r2 = new MockR2Bucket();
    service = new WorkNoteFileService(r2 as unknown as R2Bucket, baseEnv.DB);
  });

  it('uploads PDF and stores record', async () => {
    // Arrange
    await insertWorkNote('WORK-123');
    const file = new Blob(['PDF content'], { type: 'application/pdf' });

    // Act
    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'document.pdf',
      uploadedBy: 'tester@example.com',
    });

    // Assert - return value
    expect(result.workId).toBe('WORK-123');
    expect(result.originalName).toBe('document.pdf');
    expect(result.fileType).toBe('application/pdf');
    expect(result.fileSize).toBe(file.size);

    // Assert - DB record exists
    const row = await baseEnv.DB.prepare('SELECT * FROM work_note_files WHERE file_id = ?')
      .bind(result.fileId)
      .first<Record<string, unknown>>();
    expect(row).toBeTruthy();
    expect(row?.work_id).toBe('WORK-123');

    // Assert - R2 stored at expected key
    expect(r2.storage.has(result.r2Key)).toBe(true);
    expect(result.r2Key).toMatch(/^work-notes\/WORK-123\/files\//);
  });

  it('uploads HWP file successfully', async () => {
    await insertWorkNote('WORK-123');
    const file = new Blob(['HWP content'], { type: 'application/x-hwp' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'report.hwp',
      uploadedBy: 'tester@example.com',
    });

    expect(result.fileType).toBe('application/x-hwp');
    expect(r2.storage.has(result.r2Key)).toBe(true);
  });

  it('uploads Excel file successfully', async () => {
    await insertWorkNote('WORK-123');
    const file = new Blob(['Excel content'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'data.xlsx',
      uploadedBy: 'tester@example.com',
    });

    expect(result.fileType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('uploads image file successfully', async () => {
    await insertWorkNote('WORK-123');
    const file = new Blob(['PNG data'], { type: 'image/png' });

    const result = await service.uploadFile({
      workId: 'WORK-123',
      file,
      originalName: 'screenshot.png',
      uploadedBy: 'tester@example.com',
    });

    expect(result.fileType).toBe('image/png');
  });

  it('rejects files exceeding 50MB limit', async () => {
    await insertWorkNote('WORK-123');
    const oversized = { size: 51 * 1024 * 1024, type: 'application/pdf' } as unknown as Blob;

    await expect(
      service.uploadFile({
        workId: 'WORK-123',
        file: oversized,
        originalName: 'large.pdf',
        uploadedBy: 'tester@example.com',
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('rejects unsupported file types', async () => {
    await insertWorkNote('WORK-123');
    const file = new Blob(['executable'], { type: 'application/x-msdownload' });

    await expect(
      service.uploadFile({
        workId: 'WORK-123',
        file,
        originalName: 'malware.exe',
        uploadedBy: 'tester@example.com',
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('lists files for work note', async () => {
    await insertWorkNote('WORK-123');

    // Upload two files
    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['1'], { type: 'application/pdf' }),
      originalName: 'file1.pdf',
      uploadedBy: 'tester@example.com',
    });

    await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['2'], { type: 'image/png' }),
      originalName: 'file2.png',
      uploadedBy: 'tester@example.com',
    });

    // List files
    const files = await service.listFiles('WORK-123');

    expect(files).toHaveLength(2);
    const fileNames = files.map((f) => f.originalName);
    expect(fileNames).toContain('file1.pdf');
    expect(fileNames).toContain('file2.png');
  });

  it('gets file by ID', async () => {
    await insertWorkNote('WORK-123');
    const uploaded = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['content'], { type: 'application/pdf' }),
      originalName: 'test.pdf',
      uploadedBy: 'tester@example.com',
    });

    const file = await service.getFileById(uploaded.fileId);

    expect(file).not.toBeNull();
    expect(file?.fileId).toBe(uploaded.fileId);
    expect(file?.originalName).toBe('test.pdf');
  });

  it('returns null for non-existent file', async () => {
    const file = await service.getFileById('FILE-nonexistent');
    expect(file).toBeNull();
  });

  it('streams file from R2', async () => {
    await insertWorkNote('WORK-123');
    const uploaded = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['file data'], { type: 'application/pdf' }),
      originalName: 'download.pdf',
      uploadedBy: 'tester@example.com',
    });

    const { body, headers } = await service.streamFile(uploaded.fileId);

    expect(body).toBeTruthy();
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Content-Disposition')).toContain('download.pdf');
  });

  it('throws NotFoundError when streaming non-existent file', async () => {
    await expect(service.streamFile('FILE-nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('deletes file from R2 and DB', async () => {
    await insertWorkNote('WORK-123');
    const uploaded = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['data'], { type: 'application/pdf' }),
      originalName: 'delete-me.pdf',
      uploadedBy: 'tester@example.com',
    });

    await service.deleteFile(uploaded.fileId);

    // Assert - DB record soft deleted
    const row = await baseEnv.DB.prepare('SELECT deleted_at FROM work_note_files WHERE file_id = ?')
      .bind(uploaded.fileId)
      .first<Record<string, unknown>>();
    expect(row?.deleted_at).not.toBeNull();

    // Assert - R2 file removed
    expect(r2.storage.has(uploaded.r2Key)).toBe(false);

    // Assert - Not returned by getFileById
    const file = await service.getFileById(uploaded.fileId);
    expect(file).toBeNull();
  });

  it('deletes all files for work note', async () => {
    await insertWorkNote('WORK-123');

    // Upload two files
    const file1 = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['1'], { type: 'application/pdf' }),
      originalName: 'file1.pdf',
      uploadedBy: 'tester@example.com',
    });

    const file2 = await service.uploadFile({
      workId: 'WORK-123',
      file: new Blob(['2'], { type: 'image/png' }),
      originalName: 'file2.png',
      uploadedBy: 'tester@example.com',
    });

    // Delete all files for work note (R2 only - DB cleanup is via ON DELETE CASCADE)
    await service.deleteWorkNoteFiles('WORK-123');

    // Assert - Both files deleted from R2
    expect(r2.storage.has(file1.r2Key)).toBe(false);
    expect(r2.storage.has(file2.r2Key)).toBe(false);

    // Assert - DB records still exist (will be cleaned up by CASCADE when work note is deleted)
    const rows = await baseEnv.DB.prepare('SELECT file_id FROM work_note_files WHERE work_id = ?')
      .bind('WORK-123')
      .all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(2);

    // Simulate work note deletion (CASCADE deletes file records)
    await baseEnv.DB.prepare('DELETE FROM work_notes WHERE work_id = ?').bind('WORK-123').run();

    // Assert - DB records cleaned up by CASCADE
    const rowsAfterCascade = await baseEnv.DB.prepare(
      'SELECT file_id FROM work_note_files WHERE work_id = ?'
    )
      .bind('WORK-123')
      .all<Record<string, unknown>>();
    expect(rowsAfterCascade.results).toHaveLength(0);
  });
});
