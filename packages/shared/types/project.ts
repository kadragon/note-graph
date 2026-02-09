// Trace: SPEC-project-1, TASK-036
/**
 * Type definitions for Project and related entities
 */

/**
 * Project entity
 */
export interface Project {
  projectId: string; // PROJECT-{nanoid}
  name: string;
  description: string | null;
  status: ProjectStatus;
  tags: string | null; // JSON array or comma-separated
  startDate: string | null; // ISO 8601 date
  actualEndDate: string | null; // ISO 8601 date
  deptName: string | null; // FK to departments
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  deletedAt: string | null; // ISO 8601 timestamp, null = active
}

/**
 * Project status values
 */
export type ProjectStatus = '진행중' | '완료' | '보류' | '중단';

/**
 * Project participant role values
 */
export type ProjectParticipantRole = '리더' | '참여자' | '검토자';

/**
 * Project participant (team member)
 */
export interface ProjectParticipant {
  id: number;
  projectId: string;
  personId: string;
  role: ProjectParticipantRole; // e.g., '리더', '참여자', '검토자'
  joinedAt: string; // ISO 8601 timestamp
  personName?: string; // Joined from persons table
  currentDept?: string | null; // Joined from persons table
}

/**
 * Project work note association
 */
export interface ProjectWorkNote {
  id: number;
  projectId: string;
  workId: string;
  assignedAt: string; // ISO 8601 timestamp
  workTitle?: string; // Joined from work_notes table
  workCategory?: string | null; // Joined from work_notes table
}

/**
 * Project file attachment
 */
export type ProjectFileStorageType = 'R2' | 'GDRIVE';

export interface ProjectFile {
  fileId: string; // FILE-{nanoid}
  projectId: string;
  r2Key: string; // projects/{projectId}/files/{fileId}
  storageType: ProjectFileStorageType; // 'R2' or 'GDRIVE'
  gdriveFileId: string | null; // Google Drive file ID
  gdriveFolderId: string | null; // Google Drive folder ID
  gdriveWebViewLink: string | null; // Google Drive web view link
  originalName: string;
  fileType: string; // MIME type
  fileSize: number; // bytes
  uploadedBy: string; // email
  uploadedAt: string; // ISO 8601 timestamp
  embeddedAt: string | null; // ISO 8601 timestamp, null = not embedded
  deletedAt: string | null; // ISO 8601 timestamp, null = active
}

/**
 * Project statistics
 */
export interface ProjectStats {
  projectId: string;
  totalWorkNotes: number;
  totalTodos: number;
  completedTodos: number;
  pendingTodos: number;
  onHoldTodos: number;
  totalFiles: number;
  totalFileSize: number; // bytes
  lastActivity: string | null; // ISO 8601 timestamp of most recent update
}

/**
 * Detailed project with associations
 */
export interface ProjectDetail extends Project {
  participants: ProjectParticipant[];
  workNotes: ProjectWorkNote[];
  files: ProjectFile[];
  stats: ProjectStats;
}

/**
 * Filters for project listing
 */
export interface ProjectFilters {
  status?: ProjectStatus;
  deptName?: string;
  participantPersonId?: string;
  startDateFrom?: string; // ISO 8601 date
  startDateTo?: string; // ISO 8601 date
  includeDeleted?: boolean; // default false
}

/**
 * Data for creating a new project
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  status?: ProjectStatus; // default '진행중'
  tags?: string;
  startDate?: string;
  deptName?: string;
  participantPersonIds?: string[]; // Initial team members
}

/**
 * Data for updating an existing project
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string;
  startDate?: string;
  actualEndDate?: string;
  deptName?: string;
}
