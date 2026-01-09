// Trace: SPEC-project-1, TASK-044
// Integration tests for project file routes

import type { ProjectFile } from '@shared/types/project';
import * as projectFileService from '@worker/services/project-file-service.js';
import { BadRequestError } from '@worker/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, MockR2, setTestR2Bucket, testEnv } from '../test-setup';

vi.mock('@worker/services/project-file-service.js', () => {
  const uploadFile = vi.fn();
  const listFiles = vi.fn();
  const streamFile = vi.fn();
  const deleteFile = vi.fn();
  const getFileById = vi.fn();

  class MockService {
    uploadFile = uploadFile;
    listFiles = listFiles;
    streamFile = streamFile;
    deleteFile = deleteFile;
    getFileById = getFileById;
  }

  return {
    ProjectFileService: MockService,
    uploadFile,
    listFiles,
    streamFile,
    deleteFile,
    getFileById,
  };
});

vi.mock('@/services/project-file-service', () => {
  const uploadFile = vi.fn();
  const listFiles = vi.fn();
  const streamFile = vi.fn();
  const deleteFile = vi.fn();
  const getFileById = vi.fn();

  class MockService {
    uploadFile = uploadFile;
    listFiles = listFiles;
    streamFile = streamFile;
    deleteFile = deleteFile;
    getFileById = getFileById;
  }

  return {
    ProjectFileService: MockService,
    uploadFile,
    listFiles,
    streamFile,
    deleteFile,
    getFileById,
  };
});

// Inject mock R2 before any requests are made so runtime bindings see it
setTestR2Bucket(new MockR2());

describe('Project File Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);

    // Seed minimal project
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
    )
      .bind('PROJECT-FILE', '파일 테스트 프로젝트', now, now)
      .run();

    // Mock R2 bucket binding
    setTestR2Bucket(new MockR2());

    projectFileService.uploadFile.mockReset();
    projectFileService.listFiles.mockReset();
    projectFileService.streamFile.mockReset();
    projectFileService.deleteFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads, lists, downloads, and deletes a PDF file', async () => {
    projectFileService.uploadFile.mockResolvedValue({
      fileId: 'FILE-123',
      projectId: 'PROJECT-FILE',
      r2Key: 'projects/PROJECT-FILE/files/FILE-123',
      originalName: 'hello.pdf',
      fileType: 'application/pdf',
      fileSize: 9,
      uploadedBy: 'test@example.com',
      uploadedAt: new Date().toISOString(),
      embeddedAt: null,
      deletedAt: null,
    } as ProjectFile);

    projectFileService.listFiles.mockResolvedValue([
      {
        fileId: 'FILE-123',
        projectId: 'PROJECT-FILE',
        r2Key: 'projects/PROJECT-FILE/files/FILE-123',
        originalName: 'hello.pdf',
        fileType: 'application/pdf',
        fileSize: 9,
        uploadedBy: 'test@example.com',
        uploadedAt: new Date().toISOString(),
        embeddedAt: null,
        deletedAt: null,
      },
    ]);

    projectFileService.streamFile.mockResolvedValue({
      body: new Blob(['hello pdf']).stream(),
      headers: new Headers({ 'Content-Type': 'application/pdf', 'Content-Length': '9' }),
    });

    projectFileService.deleteFile.mockResolvedValue();
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch('http://localhost/api/projects/PROJECT-FILE/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json<{ fileId: string }>();
    expect(uploaded.fileId).toMatch(/^FILE-/);

    // List
    const listRes = await authFetch('http://localhost/api/projects/PROJECT-FILE/files');
    expect(listRes.status).toBe(200);
    const files = await listRes.json<Array<{ fileId: string; originalName: string }>>();
    expect(files).toHaveLength(1);
    expect(files[0].originalName).toBe('hello.pdf');

    // Download
    const dlRes = await authFetch(
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}/download`
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(await dlRes.text()).toContain('hello pdf');

    // Delete
    const delRes = await authFetch(
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}`,
      {
        method: 'DELETE',
      }
    );
    expect(delRes.status).toBe(204);

    // Download after delete should 404
    const dlAfter = await authFetch(
      `http://localhost/api/projects/PROJECT-FILE/files/${uploaded.fileId}/download`
    );
    expect(dlAfter.status).toBe(404);
  });

  it('rejects file above 50MB', async () => {
    projectFileService.uploadFile.mockRejectedValue(
      new BadRequestError('파일 크기가 제한을 초과했습니다. 최대 50MB까지 업로드 가능합니다.')
    );
    const big = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', big, 'too-big.pdf');

    const res = await authFetch('http://localhost/api/projects/PROJECT-FILE/files', {
      method: 'POST',
      body: form,
    });

    expect(res.status).toBe(400);
  });
});
