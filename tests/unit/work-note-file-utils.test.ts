// Trace: SPEC-worknote-attachments-1, TASK-063

import {
  isModifiedToday,
  sortFilesByModifiedTimeDesc,
} from '@web/pages/work-notes/components/work-note-file-utils';
import type { DriveFileListItem } from '@web/types/api';
import { describe, expect, it } from 'vitest';

describe('sortFilesByModifiedTimeDesc', () => {
  it('sorts files by modifiedTime descending (newest first)', () => {
    const files: DriveFileListItem[] = [
      {
        id: 'B',
        name: 'second.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/B',
        size: 1000,
        modifiedTime: '2024-01-02T10:00:00Z',
      },
      {
        id: 'A',
        name: 'first.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/A',
        size: 500,
        modifiedTime: '2024-01-03T09:00:00Z',
      },
      {
        id: 'C',
        name: 'third.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/C',
        size: 1500,
        modifiedTime: '2023-12-31T23:00:00Z',
      },
    ];

    const sorted = sortFilesByModifiedTimeDesc(files);

    expect(sorted.map((file) => file.id)).toEqual(['A', 'B', 'C']);
  });

  it('keeps deterministic order when modifiedTime is identical', () => {
    const files: DriveFileListItem[] = [
      {
        id: 'C',
        name: 'third.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/C',
        size: 1500,
        modifiedTime: '2024-01-03T09:00:00Z',
      },
      {
        id: 'A',
        name: 'first.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/A',
        size: 500,
        modifiedTime: '2024-01-03T09:00:00Z',
      },
      {
        id: 'B',
        name: 'second.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/file/B',
        size: 1000,
        modifiedTime: '2024-01-03T09:00:00Z',
      },
    ];

    const sorted = sortFilesByModifiedTimeDesc(files);

    expect(sorted.map((file) => file.id)).toEqual(['A', 'B', 'C']);
  });

  it('detects files modified today', () => {
    const today = new Date();
    const iso = today.toISOString();

    expect(isModifiedToday(iso)).toBe(true);
  });

  it('detects files not modified today', () => {
    expect(isModifiedToday('2024-01-01T00:00:00Z')).toBe(false);
  });
});
