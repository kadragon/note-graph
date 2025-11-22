// User types
export interface User {
  email: string;
}

// Work Note types
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
}

export interface UpdateWorkNoteRequest {
  title?: string;
  content?: string;
  category?: string;
  categoryIds?: string[];
  relatedPersonIds?: string[];
  relatedDepartmentIds?: string[];
}

// Person types
export type EmploymentStatus = '재직' | '휴직' | '퇴직';

export interface Person {
  personId: string;
  name: string;
  phoneExt?: string | null; // Up to 15 chars phone number (e.g., '043-123-4567')
  currentDept?: string | null;
  currentPosition?: string | null;
  currentRoleDesc?: string | null;
  employmentStatus: EmploymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersonDeptHistory {
  id: number;
  personId: string;
  deptName: string;
  position: string | null;
  roleDesc: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
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

// Department types
export interface Department {
  deptName: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateDepartmentRequest {
  deptName: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  description?: string;
  isActive?: boolean;
}

// Task Category types
export interface TaskCategory {
  categoryId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTaskCategoryRequest {
  name: string;
}

export interface UpdateTaskCategoryRequest {
  name?: string;
  isActive?: boolean;
}

// Todo types
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

export interface PersonSearchResult {
  personId: string;
  name: string;
  currentDept: string | null;
  currentPosition: string | null;
  phoneExt: string | null;
  employmentStatus: string;
}

export interface DepartmentSearchResult {
  deptName: string;
  description: string | null;
  isActive: boolean;
}

export interface UnifiedSearchResult {
  workNotes: SearchResult[];
  persons: PersonSearchResult[];
  departments: DepartmentSearchResult[];
  query: string;
}

// RAG types
export type RAGScope = 'global' | 'person' | 'department' | 'work';

export interface RAGQueryRequest {
  query: string;
  scope: RAGScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  topK?: number;
}

export interface RAGSource {
  workId: string;
  title: string;
  snippet: string;
  score: number;
}

export interface RAGResponse {
  answer: string;
  contexts: RAGSource[];
}

// AI Draft types
export interface AIGenerateDraftRequest {
  text: string;
}

export interface AIDraftTodo {
  title: string;
  description?: string;
  dueDate?: string;
}

export interface AIGenerateDraftResponse {
  title: string;
  category: string;
  content: string;
  todos: AIDraftTodo[];
}

// PDF types
export type PDFJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PDFJob {
  jobId: string;
  status: PDFJobStatus;
  filename?: string;
  draft?: AIGenerateDraftResponse;
  error?: string;
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
