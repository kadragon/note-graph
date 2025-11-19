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
export interface Person {
  personId: string;
  name: string;
  currentDept?: string | null;
  currentPosition?: string | null;
  currentRoleDesc?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonRequest {
  personId: string;
  name: string;
  currentDept?: string;
  currentPosition?: string;
  currentRoleDesc?: string;
}

export interface UpdatePersonRequest {
  name?: string;
  currentDept?: string;
  currentPosition?: string;
  currentRoleDesc?: string;
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
  createdAt: string;
}

export interface CreateTaskCategoryRequest {
  name: string;
}

export interface UpdateTaskCategoryRequest {
  name: string;
}

// Todo types
export type TodoStatus = '진행중' | '완료' | '보류' | '중단';
export type TodoView = 'today' | 'this_week' | 'this_month' | 'backlog' | 'all';
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RecurrenceType = 'DUE_DATE' | 'COMPLETION_DATE';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
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
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
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
