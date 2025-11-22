import type {
  User,
  WorkNote,
  CreateWorkNoteRequest,
  UpdateWorkNoteRequest,
  Person,
  PersonDeptHistory,
  CreatePersonRequest,
  UpdatePersonRequest,
  ImportPersonFromTextRequest,
  ParsedPersonData,
  ImportPersonResponse,
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  TaskCategory,
  CreateTaskCategoryRequest,
  UpdateTaskCategoryRequest,
  Todo,
  TodoView,
  TodoStatus,
  RepeatRule,
  RecurrenceType,
  CustomIntervalUnit,
  CreateTodoRequest,
  UpdateTodoRequest,
  SearchRequest,
  SearchResult,
  UnifiedSearchResult,
  PersonSearchResult,
  DepartmentSearchResult,
  RAGQueryRequest,
  RAGResponse,
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
  PDFJob,
} from '@/types/api';

/**
 * Backend work note response format
 * Maps to D1 database schema
 */
interface BackendWorkNote {
  workId: string;
  title: string;
  contentRaw: string;
  category: string | null;
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

/**
 * Backend todo response format
 * Maps to D1 database schema
 */
interface BackendTodo {
  todoId: string;
  workId: string;
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
  createdAt: string;
  updatedAt: string;
  workTitle?: string;
}

class APIClient {
  private baseURL = '/api';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // In development, use test auth header
    if (import.meta.env.DEV) {
      (headers as Record<string, string>)['X-Test-User-Email'] =
        'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: '알 수 없는 오류가 발생했습니다',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  async uploadFile<T>(
    endpoint: string,
    file: File,
    metadata: Record<string, string | undefined> = {}
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const headers: HeadersInit = {};

    // In development, use test auth header
    if (import.meta.env.DEV) {
      (headers as Record<string, string>)['X-Test-User-Email'] =
        'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: '업로드 실패',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  getMe() {
    return this.request<User>('/me');
  }

  // Work Notes
  async getWorkNotes() {
    const response = await this.request<BackendWorkNote[]>('/work-notes');
    return response.map(this.transformWorkNoteFromBackend);
  }

  async getWorkNote(workId: string) {
    const response = await this.request<BackendWorkNote>(`/work-notes/${workId}`);
    return this.transformWorkNoteFromBackend(response);
  }

  async createWorkNote(data: CreateWorkNoteRequest) {
    // Transform content to contentRaw for backend
    const { content, ...rest } = data;
    const response = await this.request<BackendWorkNote>('/work-notes', {
      method: 'POST',
      body: JSON.stringify({ ...rest, contentRaw: content }),
    });
    return this.transformWorkNoteFromBackend(response);
  }

  async updateWorkNote(workId: string, data: UpdateWorkNoteRequest) {
    // Transform content to contentRaw for backend if present
    const { content, relatedPersonIds, ...rest } = data;

    // Build payload with proper transformations
    const payload: Record<string, unknown> = { ...rest };

    if (content !== undefined) {
      payload.contentRaw = content;
    }

    // Transform relatedPersonIds to persons format for backend
    // Backend expects: persons: Array<{personId: string, role: 'OWNER' | 'RELATED'}>
    if (relatedPersonIds !== undefined) {
      payload.persons = relatedPersonIds.map(personId => ({
        personId,
        role: 'RELATED' as const,
      }));
    }

    const response = await this.request<BackendWorkNote>(`/work-notes/${workId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return this.transformWorkNoteFromBackend(response);
  }

  deleteWorkNote(workId: string) {
    return this.request<void>(`/work-notes/${workId}`, {
      method: 'DELETE',
    });
  }

  private transformWorkNoteFromBackend(backendWorkNote: BackendWorkNote): WorkNote {
    return {
      id: backendWorkNote.workId,
      title: backendWorkNote.title,
      content: backendWorkNote.contentRaw,
      category: backendWorkNote.category || '',
      categories: backendWorkNote.categories || [],
      persons: backendWorkNote.persons || [],
      createdAt: backendWorkNote.createdAt,
      updatedAt: backendWorkNote.updatedAt,
    };
  }

  private transformTodoFromBackend(backendTodo: BackendTodo): Todo {
    return {
      id: backendTodo.todoId,
      workNoteId: backendTodo.workId,
      workTitle: backendTodo.workTitle,
      title: backendTodo.title,
      description: backendTodo.description,
      status: backendTodo.status,
      dueDate: backendTodo.dueDate,
      waitUntil: backendTodo.waitUntil,
      repeatRule: backendTodo.repeatRule,
      recurrenceType: backendTodo.recurrenceType,
      customInterval: backendTodo.customInterval,
      customUnit: backendTodo.customUnit,
      skipWeekends: backendTodo.skipWeekends,
      createdAt: backendTodo.createdAt,
      updatedAt: backendTodo.updatedAt,
    };
  }

  // Persons
  getPersons() {
    return this.request<Person[]>('/persons');
  }

  createPerson(data: CreatePersonRequest) {
    return this.request<Person>('/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updatePerson(personId: string, data: UpdatePersonRequest) {
    return this.request<Person>(`/persons/${personId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  getPersonHistory(personId: string) {
    return this.request<PersonDeptHistory[]>(`/persons/${personId}/history`);
  }

  // Person Import
  parsePersonFromText(data: ImportPersonFromTextRequest) {
    return this.request<ParsedPersonData>('/persons/import-from-text', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  importPerson(data: CreatePersonRequest) {
    return this.request<ImportPersonResponse>('/persons/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Departments
  getDepartments() {
    return this.request<Department[]>('/departments');
  }

  createDepartment(data: CreateDepartmentRequest) {
    return this.request<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateDepartment(deptName: string, data: UpdateDepartmentRequest) {
    return this.request<Department>(`/departments/${deptName}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Task Categories
  getTaskCategories(activeOnly?: boolean) {
    const params = new URLSearchParams();
    if (activeOnly) params.set('activeOnly', 'true');
    const queryString = params.toString();
    return this.request<TaskCategory[]>(`/task-categories${queryString ? `?${queryString}` : ''}`);
  }

  getActiveTaskCategories() {
    return this.getTaskCategories(true);
  }

  createTaskCategory(data: CreateTaskCategoryRequest) {
    return this.request<TaskCategory>('/task-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateTaskCategory(categoryId: string, data: UpdateTaskCategoryRequest) {
    return this.request<TaskCategory>(`/task-categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  toggleTaskCategoryActive(categoryId: string, isActive: boolean) {
    return this.updateTaskCategory(categoryId, { isActive });
  }

  deleteTaskCategory(categoryId: string) {
    return this.request<void>(`/task-categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Todos
  async getTodos(view: TodoView = 'today', year?: number) {
    const params = new URLSearchParams();
    params.set('view', view);
    if (year) {
      params.set('year', year.toString());
    }
    const response = await this.request<BackendTodo[]>(`/todos?${params.toString()}`);
    return response.map(this.transformTodoFromBackend.bind(this));
  }

  async updateTodo(todoId: string, data: UpdateTodoRequest) {
    const response = await this.request<BackendTodo>(`/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return this.transformTodoFromBackend(response);
  }

  deleteTodo(todoId: string) {
    return this.request<void>(`/todos/${todoId}`, {
      method: 'DELETE',
    });
  }

  // Work Note Todos
  async getWorkNoteTodos(workId: string) {
    const response = await this.request<BackendTodo[]>(`/work-notes/${workId}/todos`);
    return response.map(this.transformTodoFromBackend.bind(this));
  }

  async createWorkNoteTodo(workId: string, data: CreateTodoRequest) {
    const response = await this.request<BackendTodo>(`/work-notes/${workId}/todos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.transformTodoFromBackend(response);
  }

  // Search
  async search(data: SearchRequest): Promise<UnifiedSearchResult> {
    interface UnifiedSearchResponse {
      workNotes: Array<{
        workNote: {
          workId: string;
          title: string;
          category: string | null;
          createdAt: string;
        };
        score: number;
        source: 'LEXICAL' | 'SEMANTIC' | 'HYBRID';
      }>;
      persons: Array<{
        personId: string;
        name: string;
        currentDept: string | null;
        currentPosition: string | null;
        phoneExt: string | null;
        employmentStatus: string;
      }>;
      departments: Array<{
        deptName: string;
        description: string | null;
        isActive: boolean;
      }>;
      query: string;
    }

    const response = await this.request<UnifiedSearchResponse>('/search/unified', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Validate response structure
    if (
      !response ||
      !Array.isArray(response.workNotes) ||
      !Array.isArray(response.persons) ||
      !Array.isArray(response.departments)
    ) {
      throw new Error('Invalid search response from server');
    }

    // Transform backend response to frontend format
    const workNotes: SearchResult[] = response.workNotes.map((item) => ({
      id: item.workNote.workId,
      title: item.workNote.title,
      category: item.workNote.category || '',
      score: item.score,
      source: item.source.toLowerCase() as 'lexical' | 'semantic' | 'hybrid',
      createdAt: item.workNote.createdAt,
    }));

    const persons: PersonSearchResult[] = response.persons.map((p) => ({
      personId: p.personId,
      name: p.name,
      currentDept: p.currentDept,
      currentPosition: p.currentPosition,
      phoneExt: p.phoneExt,
      employmentStatus: p.employmentStatus,
    }));

    const departments: DepartmentSearchResult[] = response.departments.map((d) => ({
      deptName: d.deptName,
      description: d.description,
      isActive: d.isActive,
    }));

    return {
      workNotes,
      persons,
      departments,
      query: response.query,
    };
  }

  // RAG
  ragQuery(data: RAGQueryRequest) {
    return this.request<RAGResponse>('/rag/query', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // AI Draft
  generateDraft(data: AIGenerateDraftRequest) {
    return this.request<AIGenerateDraftResponse>(
      '/ai/work-notes/draft-from-text',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  generateDraftWithSimilar(data: AIGenerateDraftRequest) {
    return this.request<AIGenerateDraftResponse>(
      '/ai/work-notes/draft-from-text-with-similar',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // PDF Jobs
  uploadPDF(file: File) {
    return this.uploadFile<PDFJob>('/pdf-jobs', file);
  }

  getPDFJob(jobId: string) {
    return this.request<PDFJob>(`/pdf-jobs/${jobId}`);
  }
}

export const API = new APIClient();
