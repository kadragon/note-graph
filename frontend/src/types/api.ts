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
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkNoteRequest {
  title: string;
  content: string;
  category: string;
  relatedPersonIds?: string[];
  relatedDepartmentIds?: string[];
}

// Person types
export interface Person {
  id: string;
  name: string;
  employeeId: string;
  departmentId?: string;
  departmentName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonRequest {
  name: string;
  employeeId: string;
  departmentId?: string;
}

// Department types
export interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentRequest {
  name: string;
}

// Todo types
export type TodoStatus = 'pending' | 'completed';
export type TodoView = 'today' | 'week' | 'month' | 'backlog' | 'all';

export interface Todo {
  id: string;
  title: string;
  status: TodoStatus;
  dueDate?: string;
  recurrence?: string;
  workNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTodoRequest {
  status?: TodoStatus;
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
  source: 'lexical' | 'semantic';
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

export interface AIGenerateDraftResponse {
  title: string;
  category: string;
  content: string;
  suggestedTodos: string[];
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
