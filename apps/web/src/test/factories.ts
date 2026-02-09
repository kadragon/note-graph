/**
 * Test factories for creating mock data
 * Each factory returns a minimal valid object with ability to override properties
 */

import type {
  Department,
  DriveFileListItem,
  Person,
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectParticipant,
  ProjectStats,
  SearchResult,
  TaskCategory,
  Todo,
  WorkNote,
  WorkNoteFile,
  WorkNoteWithStats,
} from '@web/types/api';

let idCounter = 0;

function generateId(prefix = 'test'): string {
  return `${prefix}-${++idCounter}`;
}

function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a mock WorkNote
 */
export function createWorkNote(overrides: Partial<WorkNote> = {}): WorkNote {
  const now = generateTimestamp();
  return {
    id: generateId('work'),
    title: 'Test Work Note',
    content: 'Test content',
    category: '일반',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock WorkNoteWithStats
 */
export function createWorkNoteWithStats(
  overrides: Partial<WorkNoteWithStats> = {}
): WorkNoteWithStats {
  const workNote = createWorkNote(overrides);
  return {
    ...workNote,
    todoStats: {
      total: 0,
      completed: 0,
      remaining: 0,
      pending: 0,
    },
    latestTodoDate: null,
    latestCompletedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock Todo
 */
export function createTodo(overrides: Partial<Todo> = {}): Todo {
  const now = generateTimestamp();
  return {
    id: generateId('todo'),
    title: 'Test Todo',
    status: '진행중',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock Department
 */
export function createDepartment(overrides: Partial<Department> = {}): Department {
  return {
    deptName: `Department ${++idCounter}`,
    description: null,
    isActive: true,
    createdAt: generateTimestamp(),
    ...overrides,
  };
}

/**
 * Create a mock Person
 */
export function createPerson(overrides: Partial<Person> = {}): Person {
  const now = generateTimestamp();
  const personId = String(100000 + idCounter++).slice(-6);
  return {
    personId,
    name: `Person ${personId}`,
    phoneExt: null,
    currentDept: null,
    currentPosition: null,
    currentRoleDesc: null,
    employmentStatus: '재직',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock TaskCategory
 */
export function createTaskCategory(overrides: Partial<TaskCategory> = {}): TaskCategory {
  return {
    categoryId: generateId('cat'),
    name: `Category ${idCounter}`,
    isActive: true,
    createdAt: generateTimestamp(),
    ...overrides,
  };
}

/**
 * Create a mock Project
 */
export function createProject(overrides: Partial<Project> = {}): Project {
  const now = generateTimestamp();
  return {
    projectId: generateId('PROJECT'),
    name: 'Test Project',
    description: null,
    status: '진행중',
    tags: null,
    startDate: null,
    actualEndDate: null,
    deptName: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock ProjectStats
 */
export function createProjectStats(overrides: Partial<ProjectStats> = {}): ProjectStats {
  return {
    projectId: generateId('PROJECT'),
    totalWorkNotes: 0,
    totalTodos: 0,
    completedTodos: 0,
    pendingTodos: 0,
    onHoldTodos: 0,
    totalFiles: 0,
    totalFileSize: 0,
    lastActivity: null,
    ...overrides,
  };
}

/**
 * Create a mock ProjectParticipant
 */
export function createProjectParticipant(
  overrides: Partial<ProjectParticipant> = {}
): ProjectParticipant {
  return {
    id: ++idCounter,
    projectId: generateId('PROJECT'),
    personId: String(100000 + idCounter).slice(-6),
    role: '참여자',
    joinedAt: generateTimestamp(),
    ...overrides,
  };
}

/**
 * Create a mock ProjectDetail
 */
export function createProjectDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  const project = createProject(overrides);
  return {
    ...project,
    participants: [],
    workNotes: [],
    files: [],
    stats: createProjectStats({ projectId: project.projectId }),
    ...overrides,
  };
}

/**
 * Create a mock SearchResult
 */
export function createSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: generateId('work'),
    title: 'Search Result',
    category: '일반',
    score: 0.95,
    source: 'hybrid',
    createdAt: generateTimestamp(),
    ...overrides,
  };
}

/**
 * Create a mock DriveFileListItem (for Drive folder listing)
 */
export function createDriveFileListItem(
  overrides: Partial<DriveFileListItem> = {}
): DriveFileListItem {
  const fileId = generateId('GFILE');
  return {
    id: fileId,
    name: 'test-file.pdf',
    mimeType: 'application/pdf',
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    size: 1024,
    modifiedTime: generateTimestamp(),
    ...overrides,
  };
}

/**
 * Create a mock WorkNoteFile (legacy - for migration testing)
 */
export function createWorkNoteFile(overrides: Partial<WorkNoteFile> = {}): WorkNoteFile {
  const fileId = generateId('FILE');
  const workId = overrides.workId ?? 'work-1';
  return {
    fileId,
    workId,
    r2Key: `work-notes/${workId}/files/${fileId}`,
    storageType: 'R2',
    originalName: 'test-file.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    uploadedBy: 'test@example.com',
    uploadedAt: generateTimestamp(),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock ProjectFile
 */
export function createProjectFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  const fileId = generateId('FILE');
  const projectId = overrides.projectId ?? 'PROJECT-1';
  return {
    fileId,
    projectId,
    r2Key: `projects/${projectId}/files/${fileId}`,
    storageType: 'R2',
    gdriveFileId: null,
    gdriveFolderId: null,
    gdriveWebViewLink: null,
    originalName: 'test-file.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    uploadedBy: 'test@example.com',
    uploadedAt: generateTimestamp(),
    embeddedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Reset the ID counter (useful between tests)
 */
export function resetFactoryCounter(): void {
  idCounter = 0;
}
