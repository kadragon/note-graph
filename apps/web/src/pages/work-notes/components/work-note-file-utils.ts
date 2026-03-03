// Trace: SPEC-worknote-attachments-1, TASK-063
import type { DriveFileListItem } from '@web/types/api';
import { File, FileImage, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';

export interface FileIconInfo {
  icon: LucideIcon;
  colorClass: string;
}

const hwpIconInfo: FileIconInfo = { icon: FileText, colorClass: 'text-blue-500' };
const excelIconInfo: FileIconInfo = { icon: FileSpreadsheet, colorClass: 'text-green-600' };
const imageIconInfo: FileIconInfo = { icon: FileImage, colorClass: 'text-violet-500' };

const EXTENSION_ICON_MAP: Record<string, FileIconInfo> = {
  pdf: { icon: FileText, colorClass: 'text-red-500' },
  hwp: hwpIconInfo,
  hwpx: hwpIconInfo,
  xls: excelIconInfo,
  xlsx: excelIconInfo,
  png: imageIconInfo,
  jpg: imageIconInfo,
  jpeg: imageIconInfo,
  gif: imageIconInfo,
  webp: imageIconInfo,
};

const DEFAULT_ICON_INFO: FileIconInfo = { icon: File, colorClass: 'text-muted-foreground' };

/**
 * Return the icon component and color class for a given filename based on its extension.
 */
export function getFileIconInfo(filename: string): FileIconInfo {
  const ext = filename.includes('.') ? (filename.split('.').pop()?.toLowerCase() ?? '') : '';
  return Object.hasOwn(EXTENSION_ICON_MAP, ext) ? EXTENSION_ICON_MAP[ext] : DEFAULT_ICON_INFO;
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
