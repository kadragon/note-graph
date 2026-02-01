// Trace: Phase 5.1 - Consolidate Mappers
// Tests for transforming backend work note format to frontend format

import { describe, expect, it } from 'vitest';
import type { BackendWorkNote } from './work-note';
import { transformWorkNoteFromBackend } from './work-note';

describe('transformWorkNoteFromBackend', () => {
  it('transforms backend work note to frontend format', () => {
    const backend: BackendWorkNote = {
      workId: 'work-123',
      title: '업무 제목',
      contentRaw: '업무 내용입니다.',
      category: '일반',
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T12:00:00Z',
    };

    const result = transformWorkNoteFromBackend(backend);

    expect(result).toEqual({
      id: 'work-123',
      title: '업무 제목',
      content: '업무 내용입니다.',
      category: '일반',
      categories: [],
      persons: [],
      relatedWorkNotes: [],
      files: [],
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T12:00:00Z',
    });
  });

  it('handles null category by returning empty string', () => {
    const backend: BackendWorkNote = {
      workId: 'work-456',
      title: '제목',
      contentRaw: '내용',
      category: null,
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T10:00:00Z',
    };

    const result = transformWorkNoteFromBackend(backend);

    expect(result.category).toBe('');
  });

  it('preserves optional arrays when provided', () => {
    const backend: BackendWorkNote = {
      workId: 'work-789',
      title: '제목',
      contentRaw: '내용',
      category: '기획',
      categories: [
        { categoryId: 'cat-1', name: '기획', isActive: true, createdAt: '2026-01-31T10:00:00Z' },
      ],
      persons: [
        {
          personId: 'person-1',
          personName: '홍길동',
          role: 'OWNER',
          currentDept: '기획팀',
          currentPosition: '팀장',
          phoneExt: '1234',
        },
      ],
      relatedWorkNotes: [{ relatedWorkId: 'work-111', relatedWorkTitle: '관련 업무' }],
      files: [
        {
          fileId: 'file-1',
          workId: 'work-789',
          originalName: 'test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageType: 'GDRIVE',
          uploadedBy: 'test@example.com',
          uploadedAt: '2026-01-31T10:00:00Z',
          deletedAt: null,
        },
      ],
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T10:00:00Z',
    };

    const result = transformWorkNoteFromBackend(backend);

    expect(result.categories).toHaveLength(1);
    expect(result.categories?.[0].name).toBe('기획');
    expect(result.persons).toHaveLength(1);
    expect(result.persons?.[0].personName).toBe('홍길동');
    expect(result.relatedWorkNotes).toHaveLength(1);
    expect(result.files).toHaveLength(1);
  });
});
