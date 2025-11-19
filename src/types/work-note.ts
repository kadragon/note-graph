// Trace: SPEC-worknote-1, TASK-007, TASK-003
/**
 * Type definitions for WorkNote and related entities
 */

import type { TaskCategory } from './task-category';

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
 * Detailed work note with associations
 */
export interface WorkNoteDetail extends WorkNote {
  persons: WorkNotePersonAssociation[];
  relatedWorkNotes: WorkNoteRelation[];
  categories: TaskCategory[];
  versions?: WorkNoteVersion[];
}
