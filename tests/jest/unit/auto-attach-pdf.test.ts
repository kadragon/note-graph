// Trace: spec_id=SPEC-pdf-1 task_id=TASK-0070

import { jest } from '@jest/globals';
import { autoAttachPdf } from '@web/lib/auto-attach-pdf';

describe('autoAttachPdf', () => {
  it('returns false when no PDF file is provided', async () => {
    const uploadWorkNoteFile = jest.fn() as jest.MockedFunction<
      (workNoteId: string, file: File) => Promise<unknown>
    >;

    const attached = await autoAttachPdf({
      workNoteId: 'WORK-1',
      pdfFile: undefined,
      uploadWorkNoteFile,
    });

    expect(attached).toBe(false);
    expect(uploadWorkNoteFile).not.toHaveBeenCalled();
  });

  it('returns false when PDF file is empty', async () => {
    const uploadWorkNoteFile = jest.fn() as jest.MockedFunction<
      (workNoteId: string, file: File) => Promise<unknown>
    >;
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });

    const attached = await autoAttachPdf({
      workNoteId: 'WORK-1',
      pdfFile: emptyFile,
      uploadWorkNoteFile,
    });

    expect(attached).toBe(false);
    expect(uploadWorkNoteFile).not.toHaveBeenCalled();
  });

  it('uploads the PDF and returns true when file is provided', async () => {
    const uploadWorkNoteFile = jest.fn() as jest.MockedFunction<
      (workNoteId: string, file: File) => Promise<unknown>
    >;
    uploadWorkNoteFile.mockResolvedValueOnce(undefined);
    const pdfFile = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });

    const attached = await autoAttachPdf({
      workNoteId: 'WORK-2',
      pdfFile,
      uploadWorkNoteFile,
    });

    expect(attached).toBe(true);
    expect(uploadWorkNoteFile).toHaveBeenCalledWith('WORK-2', pdfFile);
  });

  it('throws when upload fails', async () => {
    const error = new Error('upload failed');
    const uploadWorkNoteFile = jest.fn() as jest.MockedFunction<
      (workNoteId: string, file: File) => Promise<unknown>
    >;
    uploadWorkNoteFile.mockRejectedValueOnce(error);
    const pdfFile = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });

    await expect(
      autoAttachPdf({
        workNoteId: 'WORK-3',
        pdfFile,
        uploadWorkNoteFile,
      })
    ).rejects.toThrow(error);
  });
});
