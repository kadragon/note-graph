import type {
  User,
  WorkNote,
  CreateWorkNoteRequest,
  UpdateWorkNoteRequest,
  Person,
  CreatePersonRequest,
  Department,
  CreateDepartmentRequest,
  TaskCategory,
  CreateTaskCategoryRequest,
  UpdateTaskCategoryRequest,
  Todo,
  TodoView,
  UpdateTodoRequest,
  SearchRequest,
  SearchResult,
  RAGQueryRequest,
  RAGResponse,
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
  PDFJob,
} from '@/types/api';

class APIClient {
  private baseURL = '';

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
  getWorkNotes() {
    return this.request<WorkNote[]>('/work-notes');
  }

  createWorkNote(data: CreateWorkNoteRequest) {
    return this.request<WorkNote>('/work-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateWorkNote(workId: string, data: UpdateWorkNoteRequest) {
    return this.request<WorkNote>(`/work-notes/${workId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteWorkNote(workId: string) {
    return this.request<void>(`/work-notes/${workId}`, {
      method: 'DELETE',
    });
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

  updatePerson(personId: string, data: Partial<CreatePersonRequest>) {
    return this.request<Person>(`/persons/${personId}`, {
      method: 'PUT',
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

  // Task Categories
  getTaskCategories() {
    return this.request<TaskCategory[]>('/task-categories');
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

  deleteTaskCategory(categoryId: string) {
    return this.request<void>(`/task-categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Todos
  getTodos(view: TodoView = 'all') {
    return this.request<Todo[]>(`/todos?view=${view}`);
  }

  updateTodo(todoId: string, data: UpdateTodoRequest) {
    return this.request<Todo>(`/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Search
  search(data: SearchRequest) {
    return this.request<SearchResult[]>('/search/work-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  // PDF Jobs
  uploadPDF(file: File) {
    return this.uploadFile<PDFJob>('/pdf-jobs', file);
  }

  getPDFJob(jobId: string) {
    return this.request<PDFJob>(`/pdf-jobs/${jobId}`);
  }
}

export const API = new APIClient();
