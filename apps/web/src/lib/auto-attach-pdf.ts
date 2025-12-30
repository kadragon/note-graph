// Trace: spec_id=SPEC-pdf-1 task_id=TASK-0070

interface AutoAttachPdfOptions {
  workNoteId: string;
  pdfFile?: File | null;
  uploadWorkNoteFile: (workNoteId: string, file: File) => Promise<unknown>;
}

export async function autoAttachPdf({
  workNoteId,
  pdfFile,
  uploadWorkNoteFile,
}: AutoAttachPdfOptions): Promise<boolean> {
  // Return false if no file or empty file
  if (!pdfFile || pdfFile.size === 0) {
    return false;
  }

  await uploadWorkNoteFile(workNoteId, pdfFile);
  return true;
}
