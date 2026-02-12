// =============================================================================
// Barrel Export - All types re-exported from organized modules
// =============================================================================

// User types
export interface User {
  email: string;
}

export type { ImportPersonResponse, ParsedPersonData } from './models/person';
export type {
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
  Todo,
  TodoStatus,
  TodoView,
} from './models/todo';
// =============================================================================
// Model types (domain entities)
// =============================================================================
export type { WorkNote, WorkNoteWithStats } from './models/work-note';

// =============================================================================
// Request/Response types
// =============================================================================
export type {
  AIGatewayLogQueryParams,
  AIGenerateDraftRequest,
  CreateDepartmentRequest,
  CreatePersonRequest,
  CreateTaskCategoryRequest,
  CreateTodoRequest,
  CreateWorkNoteGroupRequest,
  CreateWorkNoteRequest,
  ImportPersonFromTextRequest,
  RAGQueryRequest,
  SearchRequest,
  StatisticsQueryParams,
  UpdateDepartmentRequest,
  UpdatePersonRequest,
  UpdateTaskCategoryRequest,
  UpdateTodoRequest,
  UpdateWorkNoteGroupRequest,
  UpdateWorkNoteRequest,
} from './requests';

import type {
  AIGatewayLogItem,
  AIGatewayLogsPagination,
  AIGatewayLogsResponse,
} from '@shared/types/ai-gateway-log';
// =============================================================================
// Shared type re-exports from @shared
// =============================================================================
import type { Department } from '@shared/types/department';
import type { PdfJobResponse, PdfJobStatus, WorkNoteDraft } from '@shared/types/pdf';
import type { EmploymentStatus, Person, PersonDeptHistory } from '@shared/types/person';

import type {
  DepartmentSearchItem,
  ExistingTodoSummary,
  PersonSearchItem,
  RagContextSnippet,
  RagScope,
  EnhanceWorkNoteResponse as SharedEnhanceWorkNoteResponse,
  SimilarWorkNoteReference,
} from '@shared/types/search';
import type {
  CategoryDistribution,
  DepartmentDistribution,
  PersonDistribution,
  StatisticsPeriod,
} from '@shared/types/statistics';
import type { TaskCategory } from '@shared/types/task-category';
import type {
  DriveFileListItem,
  WorkNoteFile,
  WorkNoteFileMigrationResult,
  WorkNoteFilesListResponse,
} from '@shared/types/work-note';

import type { WorkNoteGroup, WorkNoteGroupWorkNote } from '@shared/types/work-note-group';

export type { Department, TaskCategory };
export type { WorkNoteGroup, WorkNoteGroupWorkNote };
export type { EmploymentStatus, Person, PersonDeptHistory };
export type { AIGatewayLogItem, AIGatewayLogsPagination, AIGatewayLogsResponse };
export type {
  DriveFileListItem,
  WorkNoteFile,
  WorkNoteFileMigrationResult,
  WorkNoteFilesListResponse,
};
// Legacy response type (deprecated - use WorkNoteFilesListResponse)
export interface WorkNoteFilesResponse {
  files: WorkNoteFile[];
  googleDriveConfigured: boolean;
}

export type { CategoryDistribution, DepartmentDistribution, PersonDistribution, StatisticsPeriod };

// Type aliases for legacy compatibility
export type PersonSearchResult = PersonSearchItem;
export type DepartmentSearchResult = DepartmentSearchItem;
export type RAGScope = RagScope;
export type RAGSource = RagContextSnippet;
export type AIDraftReference = SimilarWorkNoteReference;
export type AIDraftPayload = WorkNoteDraft;
export type PDFJobStatus = PdfJobStatus;
export type PDFJob = PdfJobResponse;
export type EnhanceWorkNoteResponse = SharedEnhanceWorkNoteResponse;
export type { ExistingTodoSummary };

// Frontend-specific request type (extends shared type with optional file)
export interface EnhanceWorkNoteRequest {
  newContent: string;
  generateNewTodos?: boolean;
  file?: File;
}

// Extract Todo type from AIDraftPayload
export type AIDraftTodo = import('@shared/types/pdf').WorkNoteDraft['todos'][number];

// =============================================================================
// Response types (defined locally)
// =============================================================================

// Search response types
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

// RAG response types
export interface RAGResponse {
  answer: string;
  contexts: RAGSource[];
}

// AI Draft response types
export interface AIGenerateDraftResponse {
  draft: AIDraftPayload;
  references: AIDraftReference[];
  meetingReferences?: AIDraftMeetingReference[];
}

export interface AIDraftMeetingReference {
  meetingId: string;
  meetingDate: string;
  topic: string;
  keywords: string[];
  score: number;
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

// Statistics response types
export interface WorkNoteStatisticsItem {
  workId: string;
  title: string;
  contentRaw: string;
  category: string | null;
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

// Google Drive status
export interface GoogleDriveStatus {
  connected: boolean;
  connectedAt?: string;
  scope?: string;
  calendarConnected?: boolean;
  /** True if user needs to re-authenticate to get updated scopes (e.g., drive.file -> drive) */
  needsReauth?: boolean;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}
