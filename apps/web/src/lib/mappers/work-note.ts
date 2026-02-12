// Trace: Phase 5.1 - Consolidate Mappers
// Transform backend work note format to frontend format

import type { TaskCategory } from '@shared/types/task-category';
import type { WorkNoteFile } from '@shared/types/work-note';
import type { WorkNoteGroup } from '@shared/types/work-note-group';
import type { WorkNote } from '@web/types/models/work-note';

/**
 * Backend work note response format
 * Maps to D1 database schema
 */
export interface BackendWorkNote {
  workId: string;
  title: string;
  contentRaw: string;
  category: string | null;
  categories?: TaskCategory[];
  groups?: WorkNoteGroup[];
  persons?: Array<{
    personId: string;
    personName: string;
    role: 'OWNER' | 'RELATED';
    currentDept?: string | null;
    currentPosition?: string | null;
    phoneExt?: string | null;
  }>;
  relatedWorkNotes?: Array<{
    relatedWorkId: string;
    relatedWorkTitle?: string;
  }>;
  relatedMeetingMinutes?: Array<{
    meetingId: string;
    meetingDate: string;
    topic: string;
    keywords: string[];
  }>;
  files?: WorkNoteFile[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform backend work note response to frontend WorkNote format
 */
export function transformWorkNoteFromBackend(backendWorkNote: BackendWorkNote): WorkNote {
  return {
    id: backendWorkNote.workId,
    title: backendWorkNote.title,
    content: backendWorkNote.contentRaw,
    category: backendWorkNote.category || '',
    categories: backendWorkNote.categories || [],
    groups: backendWorkNote.groups || [],
    persons: backendWorkNote.persons || [],
    relatedWorkNotes: backendWorkNote.relatedWorkNotes || [],
    relatedMeetingMinutes: backendWorkNote.relatedMeetingMinutes || [],
    files: backendWorkNote.files || [],
    createdAt: backendWorkNote.createdAt,
    updatedAt: backendWorkNote.updatedAt,
  };
}
