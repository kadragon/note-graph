// Trace: SPEC-worknote-attachments-1, TASK-063
import type { WorkNoteFile } from '@web/types/api';

/**
 * Sort files by uploadedAt descending (newest first).
 * Ties are broken deterministically by fileId ascending.
 */
export function sortFilesByUploadedAtDesc(files: WorkNoteFile[]): WorkNoteFile[] {
  return [...files].sort((a, b) => {
    const timeDiff = new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.fileId.localeCompare(b.fileId);
  });
}

/**
 * Check if a file was uploaded on the current local day.
 */
export function isUploadedToday(uploadedAt: string): boolean {
  const uploaded = new Date(uploadedAt);
  const now = new Date();

  return (
    uploaded.getFullYear() === now.getFullYear() &&
    uploaded.getMonth() === now.getMonth() &&
    uploaded.getDate() === now.getDate()
  );
}
