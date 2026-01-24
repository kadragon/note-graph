// Trace: SPEC-worknote-attachments-1, TASK-063
import type { DriveFileListItem } from '@web/types/api';

/**
 * Sort files by modifiedTime descending (newest first).
 * Ties are broken deterministically by id ascending.
 */
export function sortFilesByModifiedTimeDesc(files: DriveFileListItem[]): DriveFileListItem[] {
  return [...files].sort((a, b) => {
    const timeDiff = new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Check if a file was modified on the current local day.
 */
export function isModifiedToday(modifiedTime: string): boolean {
  const modified = new Date(modifiedTime);
  const now = new Date();

  return (
    modified.getFullYear() === now.getFullYear() &&
    modified.getMonth() === now.getMonth() &&
    modified.getDate() === now.getDate()
  );
}
