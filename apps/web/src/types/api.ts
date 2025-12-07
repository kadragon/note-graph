// User types
export interface User {
  email: string;
}

// Shared type re-exports
// Using import + export pattern for types used within this file
import type { Department } from '@shared/types/department';
import type { PdfJobResponse, PdfJobStatus, WorkNoteDraft } from '@shared/types/pdf';
import type { EmploymentStatus, Person, PersonDeptHistory } from '@shared/types/person';
import type {
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectParticipant,
  ProjectParticipantRole,
  ProjectPriority,
  ProjectStats,
  ProjectStatus,
} from '@shared/types/project';
import type {
  DepartmentSearchItem,
  PersonSearchItem,
  RagContextSnippet,
  RagScope,
  SimilarWorkNoteReference,
} from '@shared/types/search';
import type {
  CategoryDistribution,
  DepartmentDistribution,
  PersonDistribution,
  StatisticsPeriod,
} from '@shared/types/statistics';
import type { TaskCategory } from '@shared/types/task-category';
import type { WorkNoteFile } from '@shared/types/work-note';

export type { Department, TaskCategory };
export type { EmploymentStatus, Person, PersonDeptHistory };
export type { WorkNoteFile };
export type {
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectParticipant,
  ProjectParticipantRole,
  ProjectPriority,
  ProjectStats,
  ProjectStatus,
};
export type { CategoryDistribution, DepartmentDistribution, PersonDistribution, StatisticsPeriod };
export type PersonSearchResult = PersonSearchItem;
export type DepartmentSearchResult = DepartmentSearchItem;
export type RAGScope = RagScope;
export type RAGSource = RagContextSnippet;
export type AIDraftReference = SimilarWorkNoteReference;
export type AIDraftPayload = WorkNoteDraft;
export type PDFJobStatus = PdfJobStatus;
export type PDFJob = PdfJobResponse;

// Work Note types (Frontend View Model)
export interface WorkNote {
  id: string;
  title: string;
  content: string;
  category: string;
  categories?: TaskCategory[];
  persons?: Array<{
    personId: string;
    personName: string;
    role: 'OWNER' | 'RELATED';
    currentDept?: string | null;
    currentPosition?: string | null;
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
}

export interface CreateWorkNoteRequest {
  title: string;
  content: string; // Will be sent as contentRaw to backend
  category?: string;
  categoryIds?: string[];
  relatedPersonIds?: string[];
  relatedDepartmentIds?: string[];
  relatedWorkIds?: string[];
}

export interface UpdateWorkNoteRequest {
  title?: string;
  content?: string;
  category?: string;
  categoryIds?: string[];
  relatedPersonIds?: string[];
  relatedDepartmentIds?: string[];
  relatedWorkIds?: string[];
}

export interface CreatePersonRequest {
  personId: string;
  name: string;
  phoneExt?: string;
  currentDept?: string;
  currentPosition?: string;
  currentRoleDesc?: string;
  employmentStatus?: EmploymentStatus;
}

export interface UpdatePersonRequest {
  name?: string;
  phoneExt?: string;
  currentDept?: string;
  currentPosition?: string;
  currentRoleDesc?: string;
  employmentStatus?: EmploymentStatus;
}

// Person import types
export interface ImportPersonFromTextRequest {
  text: string;
}

export interface ParsedPersonData {
  personId: string;
  name: string;
  phoneExt?: string | null;
  currentDept?: string | null;
  currentPosition?: string | null;
  currentRoleDesc?: string | null;
  employmentStatus: EmploymentStatus;
}

export interface ImportPersonResponse {
  person: Person;
  isNew: boolean;
}

export interface CreateDepartmentRequest {
  deptName: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  description?: string;
  isActive?: boolean;
}

export interface CreateTaskCategoryRequest {
  name: string;
}

export interface UpdateTaskCategoryRequest {
  name?: string;
  isActive?: boolean;
}

// Todo types (Frontend View Model)
export type TodoStatus = '진행중' | '완료' | '보류' | '중단';
export type TodoView = 'today' | 'week' | 'month' | 'remaining' | 'completed';
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceType = 'DUE_DATE' | 'COMPLETION_DATE';
export type CustomIntervalUnit = 'DAY' | 'WEEK' | 'MONTH';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number;
  customUnit?: CustomIntervalUnit;
  skipWeekends?: boolean;
  workNoteId?: string;
  workTitle?: string;
  workCategory?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number;
  customUnit?: CustomIntervalUnit;
  skipWeekends?: boolean;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number | null;
  customUnit?: CustomIntervalUnit | null;
  skipWeekends?: boolean;
}

// Search types
export interface SearchRequest {
  query: string;
}

export interface SearchResult {
  id: string;
  title: string;
  category: string;
  score: number;
  source: 'lexical' | 'semantic' | 'hybrid';
  createdAt: string;
}

export interface UnifiedSearchResult {
  workNotes: SearchResult[];
  persons: PersonSearchResult[];
  departments: DepartmentSearchResult[];
  query: string;
}

// RAG types
export interface RAGQueryRequest {
  query: string;
  scope: RAGScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  projectId?: string;
  topK?: number;
}

export interface RAGResponse {
  answer: string;
  contexts: RAGSource[];
}

// AI Draft types
export interface AIGenerateDraftRequest {
  inputText: string;
  category?: string;
  personIds?: string[];
  deptName?: string;
}

// Extract Todo type from AIDraftPayload
export type AIDraftTodo = import('@shared/types/pdf').WorkNoteDraft['todos'][number];

export interface AIGenerateDraftResponse {
  draft: AIDraftPayload;
  references: AIDraftReference[];
}

// Vector Store types
export interface EmbeddingStats {
  total: number;
  embedded: number;
  pending: number;
}

export interface BatchProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

// Project types
export interface ProjectFilters {
  status?: ProjectStatus;
  leaderPersonId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string;
  priority?: ProjectPriority;
  startDate?: string;
  targetEndDate?: string;
  leaderPersonId?: string;
  deptName?: string;
  participantIds?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string;
  priority?: ProjectPriority;
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  leaderPersonId?: string;
  deptName?: string;
}

export interface AssignWorkNoteRequest {
  workId: string;
}

// Statistics types
export interface WorkNoteStatisticsItem {
  workId: string;
  title: string;
  contentRaw: string;
  category: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  embeddedAt: string | null;
  completedTodoCount: number;
  totalTodoCount: number;
  assignedPersons: Array<{
    personId: string;
    personName: string;
    currentDept: string | null;
    role: 'OWNER' | 'RELATED';
  }>;
  /**
   * Human-readable category name from task_categories table
   * Used for UI display instead of categoryId
   */
  categoryName?: string | null;
}

export interface WorkNoteStatistics {
  summary: {
    totalWorkNotes: number;
    totalCompletedTodos: number;
    totalTodos: number;
    completionRate: number; // Percentage (0-100)
  };
  distributions: {
    byCategory: CategoryDistribution[];
    byPerson: PersonDistribution[];
    byDepartment: DepartmentDistribution[];
  };
  workNotes: WorkNoteStatisticsItem[];
}

export interface StatisticsQueryParams {
  period: StatisticsPeriod;
  year?: number;
  startDate?: string;
  endDate?: string;
  personId?: string;
  deptName?: string;
  category?: string;
}
