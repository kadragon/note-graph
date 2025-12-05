// User types
export interface User {
  email: string;
}

import type { Department as SharedDepartment } from '@shared/types/department';
// Shared Entities
import type {
  EmploymentStatus as SharedEmploymentStatus,
  Person as SharedPerson,
  PersonDeptHistory as SharedPersonDeptHistory,
} from '@shared/types/person';
import type {
  Project as SharedProject,
  ProjectDetail as SharedProjectDetail,
  ProjectFile as SharedProjectFile,
  ProjectParticipant as SharedProjectParticipant,
  ProjectParticipantRole as SharedProjectParticipantRole,
  ProjectPriority as SharedProjectPriority,
  ProjectStats as SharedProjectStats,
  ProjectStatus as SharedProjectStatus,
} from '@shared/types/project';
import type {
  CategoryDistribution as SharedCategoryDistribution,
  DepartmentDistribution as SharedDepartmentDistribution,
  PersonDistribution as SharedPersonDistribution,
  StatisticsPeriod as SharedStatisticsPeriod,
} from '@shared/types/statistics';
import type { TaskCategory as SharedTaskCategory } from '@shared/types/task-category';

// Re-exports of shared types that match frontend needs exactly
export type EmploymentStatus = SharedEmploymentStatus;
export type Person = SharedPerson;
export type PersonDeptHistory = SharedPersonDeptHistory;
export type Department = SharedDepartment;
export type TaskCategory = SharedTaskCategory;
export type Project = SharedProject;
export type ProjectDetail = SharedProjectDetail;
export type ProjectFile = SharedProjectFile;
export type ProjectParticipant = SharedProjectParticipant;
export type ProjectParticipantRole = SharedProjectParticipantRole;
export type ProjectPriority = SharedProjectPriority;
export type ProjectStats = SharedProjectStats;
export type ProjectStatus = SharedProjectStatus;
export type StatisticsPeriod = SharedStatisticsPeriod;
export type CategoryDistribution = SharedCategoryDistribution;
export type DepartmentDistribution = SharedDepartmentDistribution;
export type PersonDistribution = SharedPersonDistribution;

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

import type {
  DepartmentSearchItem as SharedDepartmentSearchItem,
  PersonSearchItem as SharedPersonSearchItem,
} from '@shared/types/search';

export type PersonSearchResult = SharedPersonSearchItem;
export type DepartmentSearchResult = SharedDepartmentSearchItem;

export interface UnifiedSearchResult {
  workNotes: SearchResult[];
  persons: PersonSearchResult[];
  departments: DepartmentSearchResult[];
  query: string;
}

// RAG types
import type {
  RagContextSnippet as SharedRagContextSnippet,
  RagScope as SharedRagScope,
} from '@shared/types/search';

export type RAGScope = SharedRagScope;

export interface RAGQueryRequest {
  query: string;
  scope: RAGScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  projectId?: string;
  topK?: number;
}

export type RAGSource = SharedRagContextSnippet;

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

// Re-map AIDraftPayload to WorkNoteDraft
// Note: WorkNoteDraft in shared/types/pdf.ts matches AIDraftPayload
// but we need to check imports.
import type { WorkNoteDraft as PdfWorkNoteDraft } from '@shared/types/pdf';
export type AIDraftPayload = PdfWorkNoteDraft;

// Extract Todo type from AIDraftPayload
export type AIDraftTodo = AIDraftPayload['todos'][number];

import type { SimilarWorkNoteReference } from '@shared/types/search';
export type AIDraftReference = SimilarWorkNoteReference;

export interface AIGenerateDraftResponse {
  draft: AIDraftPayload;
  references: AIDraftReference[];
}

// PDF types
import type { PdfJobResponse, PdfJobStatus } from '@shared/types/pdf';

export type PDFJobStatus = PdfJobStatus;
export type PDFJob = PdfJobResponse;

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
