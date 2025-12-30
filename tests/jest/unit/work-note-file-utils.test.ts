// Trace: SPEC-testing-migration-001, TASK-MIGRATE-004

import {
  isUploadedToday,
  sortFilesByUploadedAtDesc,
} from '@web/pages/work-notes/components/work-note-file-utils';
import type { WorkNoteFile } from '@web/types/api';

describe('sortFilesByUploadedAtDesc', () => {
  it('sorts files by uploadedAt descending (newest first)', () => {
    const files: WorkNoteFile[] = [
      {
        fileId: 'B',
        workId: 'W',
        r2Key: 'work-notes/W/files/B',
        originalName: 'second.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        uploadedBy: 'user@example.com',
        uploadedAt: '2024-01-02T10:00:00Z',
        deletedAt: null,
      },
      {
        fileId: 'A',
        workId: 'W',
        r2Key: 'work-notes/W/files/A',
        originalName: 'first.pdf',
        fileType: 'application/pdf',
        fileSize: 500,
        uploadedBy: 'user@example.com',
        uploadedAt: '2024-01-03T09:00:00Z',
        deletedAt: null,
      },
      {
        fileId: 'C',
        workId: 'W',
        r2Key: 'work-notes/W/files/C',
        originalName: 'third.pdf',
        fileType: 'application/pdf',
        fileSize: 1500,
        uploadedBy: 'user@example.com',
        uploadedAt: '2023-12-31T23:00:00Z',
        deletedAt: null,
      },
    ];

    const sorted = sortFilesByUploadedAtDesc(files);

    expect(sorted.map((file) => file.fileId)).toEqual(['A', 'B', 'C']);
  });

  it('keeps deterministic order when uploadedAt is identical', () => {
    const files: WorkNoteFile[] = [
      {
        fileId: 'C',
        workId: 'W',
        r2Key: 'work-notes/W/files/C',
        originalName: 'third.pdf',
        fileType: 'application/pdf',
        fileSize: 1500,
        uploadedBy: 'user@example.com',
        uploadedAt: '2024-01-03T09:00:00Z',
        deletedAt: null,
      },
      {
        fileId: 'A',
        workId: 'W',
        r2Key: 'work-notes/W/files/A',
        originalName: 'first.pdf',
        fileType: 'application/pdf',
        fileSize: 500,
        uploadedBy: 'user@example.com',
        uploadedAt: '2024-01-03T09:00:00Z',
        deletedAt: null,
      },
      {
        fileId: 'B',
        workId: 'W',
        r2Key: 'work-notes/W/files/B',
        originalName: 'second.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        uploadedBy: 'user@example.com',
        uploadedAt: '2024-01-03T09:00:00Z',
        deletedAt: null,
      },
    ];

    const sorted = sortFilesByUploadedAtDesc(files);

    expect(sorted.map((file) => file.fileId)).toEqual(['A', 'B', 'C']);
  });

  it('detects files uploaded today', () => {
    const today = new Date();
    const iso = today.toISOString();

    expect(isUploadedToday(iso)).toBe(true);
  });

  it('detects files not uploaded today', () => {
    expect(isUploadedToday('2024-01-01T00:00:00Z')).toBe(false);
  });
});
