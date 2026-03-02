// Trace: SPEC-worknote-attachments-1, TASK-063
import type { DriveFileListItem } from '@web/types/api';
import { File, FileImage, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';

export interface FileIconInfo {
  icon: LucideIcon;
  colorClass: string;
}

const EXTENSION_ICON_MAP: Record<string, FileIconInfo> = {
  pdf: { icon: FileText, colorClass: 'text-red-500' },
  hwp: { icon: FileText, colorClass: 'text-blue-500' },
  hwpx: { icon: FileText, colorClass: 'text-blue-500' },
  xls: { icon: FileSpreadsheet, colorClass: 'text-green-600' },
  xlsx: { icon: FileSpreadsheet, colorClass: 'text-green-600' },
  png: { icon: FileImage, colorClass: 'text-violet-500' },
  jpg: { icon: FileImage, colorClass: 'text-violet-500' },
  jpeg: { icon: FileImage, colorClass: 'text-violet-500' },
  gif: { icon: FileImage, colorClass: 'text-violet-500' },
  webp: { icon: FileImage, colorClass: 'text-violet-500' },
};

const DEFAULT_ICON_INFO: FileIconInfo = { icon: File, colorClass: 'text-muted-foreground' };

/**
 * Return the icon component and color class for a given filename based on its extension.
 */
export function getFileIconInfo(filename: string): FileIconInfo {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  return EXTENSION_ICON_MAP[ext] ?? DEFAULT_ICON_INFO;
}

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
