import type { TaskCategory } from '@shared/types/task-category';
import type { WorkNoteFile } from '@shared/types/work-note';
import type { WorkNoteGroup } from '@shared/types/work-note-group';

// Work Note types (Frontend View Model)
export interface WorkNote {
  id: string;
  title: string;
  content: string;
  category: string;
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
  files?: WorkNoteFile[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkNoteWithStats extends WorkNote {
  todoStats: {
    total: number;
    completed: number;
    remaining: number;
    pending: number;
  };
  latestTodoDate: string | null;
  latestCompletedAt: string | null;
}
