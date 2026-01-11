import { pdf } from '@react-pdf/renderer';
import type { Todo, WorkNoteWithStats } from '@web/types/api';
import { format, parseISO } from 'date-fns';

import { WorkNotePDFDocument } from './work-note-pdf-document';

/**
 * Generate a PDF blob from a work note
 */
export async function generateWorkNotePDF(
  workNote: WorkNoteWithStats,
  todos: Todo[]
): Promise<Blob> {
  const doc = WorkNotePDFDocument({ workNote, todos });
  const blob = await pdf(doc).toBlob();
  return blob;
}

/**
 * Generate a filename for the PDF in YYYYMMDD_Title.pdf format
 */
export function generatePDFFilename(workNote: WorkNoteWithStats): string {
  const date = format(parseISO(workNote.createdAt), 'yyyyMMdd');
  const sanitizedTitle = workNote.title.replace(/[/\\:*?"<>|]/g, '_');
  return `${date}_${sanitizedTitle}.pdf`;
}
