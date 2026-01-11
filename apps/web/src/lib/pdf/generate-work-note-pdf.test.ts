import { createWorkNoteWithStats, resetFactoryCounter } from '@web/test/factories';
import { beforeEach, describe, expect, it } from 'vitest';

import { generatePDFFilename, generateWorkNotePDF } from './generate-work-note-pdf';

describe('generateWorkNotePDF', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('generates PDF blob with correct type', async () => {
    const workNote = createWorkNoteWithStats({ title: '테스트 업무' });
    const todos: never[] = [];

    const blob = await generateWorkNotePDF(workNote, todos);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
  });
});

describe('generatePDFFilename', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('returns filename with date and title in YYYYMMDD_Title.pdf format', () => {
    const workNote = createWorkNoteWithStats({
      title: '테스트 업무',
      createdAt: '2024-06-15T10:00:00.000Z',
    });

    const filename = generatePDFFilename(workNote);

    expect(filename).toBe('20240615_테스트 업무.pdf');
  });

  it('sanitizes special characters in filename', () => {
    const workNote = createWorkNoteWithStats({
      title: '업무/노트:테스트',
      createdAt: '2024-06-15T10:00:00.000Z',
    });

    const filename = generatePDFFilename(workNote);

    expect(filename).toBe('20240615_업무_노트_테스트.pdf');
  });
});
