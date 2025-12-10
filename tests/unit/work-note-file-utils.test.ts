// Trace: SPEC-worknote-attachments-1, TASK-063

import {
  isUploadedToday,
  sortFilesByUploadedAtDesc,
} from '@web/pages/work-notes/components/work-note-file-utils';
import type { WorkNoteFile } from '@web/types/api';
import { describe, expect, it } from 'vitest';

describe('sortFilesByUploadedAtDesc', () => {
  it('sorts files by uploadedAt descending (newest first)', () => {
    const files: WorkNoteFile[] = [
      {
        fileId: 'B',
        workId: 'W',
        originalName: 'second.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        uploadedAt: '2024-01-02T10:00:00Z',
      },
      {
        fileId: 'A',
        workId: 'W',
        originalName: 'first.pdf',
        fileType: 'application/pdf',
        fileSize: 500,
        uploadedAt: '2024-01-03T09:00:00Z',
      },
      {
        fileId: 'C',
        workId: 'W',
        originalName: 'third.pdf',
        fileType: 'application/pdf',
        fileSize: 1500,
        uploadedAt: '2023-12-31T23:00:00Z',
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
        originalName: 'third.pdf',
        fileType: 'application/pdf',
        fileSize: 1500,
        uploadedAt: '2024-01-03T09:00:00Z',
      },
      {
        fileId: 'A',
        workId: 'W',
        originalName: 'first.pdf',
        fileType: 'application/pdf',
        fileSize: 500,
        uploadedAt: '2024-01-03T09:00:00Z',
      },
      {
        fileId: 'B',
        workId: 'W',
        originalName: 'second.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        uploadedAt: '2024-01-03T09:00:00Z',
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
