// Trace: SPEC-worknote-1, TASK-007, TASK-003, TASK-041
/**
 * Type definitions for WorkNote and related entities
 */

import type { TaskCategory } from './task-category';
import type { WorkNoteGroup } from './work-note-group';

/**
 * Work note entity
 */
export interface WorkNote {
  workId: string; // WORK-{ulid}
  title: string;
  contentRaw: string;
  category: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  embeddedAt: string | null; // ISO 8601 timestamp, null = not embedded
}

/**
 * Work note version
 */
export interface WorkNoteVersion {
  id: number;
  workId: string;
  versionNo: number;
  title: string;
  contentRaw: string;
  category: string | null;
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Work note person association
 */
export interface WorkNotePersonAssociation {
  id: number;
  workId: string;
  personId: string;
  role: 'OWNER' | 'RELATED';
  personName?: string; // Joined from persons table
  currentDept?: string | null; // Joined from persons table
  currentPosition?: string | null; // Joined from persons table
  phoneExt?: string | null; // Joined from persons table
}

/**
 * Work note relation
 */
export interface WorkNoteRelation {
  id: number;
  workId: string;
  relatedWorkId: string;
  relatedWorkTitle?: string; // Joined from work_notes table
}

/**
 * Linked meeting minute summary on a work note
 */
export interface WorkNoteMeetingMinuteSummary {
  meetingId: string;
  meetingDate: string; // YYYY-MM-DD
  topic: string;
  keywords: string[];
}

/**
 * Storage type for work note files
 */
export type WorkNoteFileStorageType = 'R2' | 'GDRIVE';

/**
 * Work note file attachment
 */
export interface WorkNoteFile {
  fileId: string; // FILE-{nanoid}
  workId: string;
  r2Key?: string; // work-notes/{workId}/files/{fileId} - deprecated, for R2 storage
  gdriveFileId?: string; // Google Drive file ID
  gdriveFolderId?: string; // Google Drive folder ID
  gdriveWebViewLink?: string; // Google Drive web view link
  storageType: WorkNoteFileStorageType; // 'R2' or 'GDRIVE'
  originalName: string;
  fileType: string; // MIME type
  fileSize: number; // bytes
  uploadedBy: string; // email
  uploadedAt: string; // ISO 8601 timestamp
  deletedAt: string | null; // ISO 8601 timestamp, null = active
}

/**
 * Result summary for migrating work note files from R2 to Google Drive
 */
export interface WorkNoteFileMigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

/**
 * Google Drive file info returned from folder listing (Drive API files.list)
 */
export interface DriveFileListItem {
  id: string; // Drive file ID
  name: string; // File name
  mimeType: string; // MIME type
  webViewLink: string; // Drive web viewer URL
  size: number; // File size in bytes
  modifiedTime: string; // Last modified time (ISO 8601)
}

/**
 * Response format for work note files list endpoint
 * Uses Drive folder as source of truth instead of DB tracking
 */
export interface WorkNoteFilesListResponse {
  files: DriveFileListItem[]; // Files from Drive folder
  driveFolderId: string | null; // Drive folder ID (null if not created yet)
  driveFolderLink: string | null; // Drive folder web link
  googleDriveConfigured: boolean; // Whether Drive OAuth is configured
  hasLegacyFiles: boolean; // Whether R2 legacy files exist (for migration prompt)
}

/**
 * Detailed work note with associations
 */
export interface WorkNoteDetail extends WorkNote {
  persons: WorkNotePersonAssociation[];
  relatedWorkNotes: WorkNoteRelation[];
  relatedMeetingMinutes?: WorkNoteMeetingMinuteSummary[];
  categories: TaskCategory[];
  groups: WorkNoteGroup[];
  versions?: WorkNoteVersion[];
  files?: WorkNoteFile[];
}
