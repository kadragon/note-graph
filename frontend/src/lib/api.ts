import type {
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
  AssignWorkNoteRequest,
  BatchProcessResult,
  CreateDepartmentRequest,
  CreatePersonRequest,
  CreateProjectRequest,
  CreateTaskCategoryRequest,
  CreateTodoRequest,
  CreateWorkNoteRequest,
  CustomIntervalUnit,
  Department,
  DepartmentSearchResult,
  EmbeddingStats,
  ImportPersonFromTextRequest,
  ImportPersonResponse,
  ParsedPersonData,
  PDFJob,
  Person,
  PersonDeptHistory,
  PersonSearchResult,
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectFilters,
  ProjectStats,
  RAGQueryRequest,
  RAGResponse,
  RecurrenceType,
  RepeatRule,
  SearchRequest,
  SearchResult,
  StatisticsQueryParams,
  TaskCategory,
  Todo,
  TodoStatus,
  TodoView,
  UnifiedSearchResult,
  UpdateDepartmentRequest,
  UpdatePersonRequest,
  UpdateProjectRequest,
  UpdateTaskCategoryRequest,
  UpdateTodoRequest,
  UpdateWorkNoteRequest,
  User,
  WorkNote,
  WorkNoteStatistics,
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
  relatedWorkNotes?: Array<{
    relatedWorkId: string;
    relatedWorkTitle?: string;
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

export class APIClient {
  private baseURL = '/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // In development, use test auth header
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      (headers as Record<string, string>)['X-Test-User-Email'] = 'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: '알 수 없는 오류가 발생했습니다',
      }))) as { message?: string };
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json() as Promise<T>;
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

    const headers: Record<string, string> = {};

    // In development, use test auth header
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      headers['X-Test-User-Email'] = 'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: '업로드 실패',
      }))) as { message?: string };
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth
  getMe() {
    return this.request<User>('/me');
  }

  // Work Notes
  async getWorkNotes() {
    const response = await this.request<BackendWorkNote[]>('/work-notes');
    return response.map((note) => this.transformWorkNoteFromBackend(note));
  }

  async getWorkNote(workId: string) {
    const response = await this.request<BackendWorkNote>(`/work-notes/${workId}`);
    return this.transformWorkNoteFromBackend(response);
  }

  async createWorkNote(data: CreateWorkNoteRequest) {
    // Transform content to contentRaw for backend
    const { content, relatedPersonIds, relatedWorkIds, ...rest } = data;

    const payload: Record<string, unknown> = {
      ...rest,
      contentRaw: content,
    };

    this.appendRelationPayload(payload, relatedPersonIds, relatedWorkIds);

    const response = await this.request<BackendWorkNote>('/work-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return this.transformWorkNoteFromBackend(response);
  }

  async updateWorkNote(workId: string, data: UpdateWorkNoteRequest) {
    // Transform content to contentRaw for backend if present
    const { content, relatedPersonIds, relatedWorkIds, ...rest } = data;

    // Build payload with proper transformations
    const payload: Record<string, unknown> = { ...rest };

    if (content !== undefined) {
      payload.contentRaw = content;
    }

    this.appendRelationPayload(payload, relatedPersonIds, relatedWorkIds);

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
      relatedWorkNotes: backendWorkNote.relatedWorkNotes || [],
      createdAt: backendWorkNote.createdAt,
      updatedAt: backendWorkNote.updatedAt,
    };
  }

  /**
   * Transforms relatedPersonIds and relatedWorkIds to backend format
   * Reduces code duplication between createWorkNote and updateWorkNote
   */
  private appendRelationPayload(
    payload: Record<string, unknown>,
    relatedPersonIds?: string[],
    relatedWorkIds?: string[]
  ): void {
    if (relatedPersonIds !== undefined) {
      payload.persons = relatedPersonIds.map((personId) => ({
        personId,
        role: 'RELATED' as const,
      }));
    }

    if (relatedWorkIds !== undefined) {
      payload.relatedWorkIds = relatedWorkIds;
    }
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
  getDepartments(params?: { q?: string; limit?: number }, signal?: AbortSignal) {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<Department[]>(`/departments${qs ? `?${qs}` : ''}`, { signal });
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
    return this.request<AIGenerateDraftResponse>('/ai/work-notes/draft-from-text', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  generateDraftWithSimilar(data: AIGenerateDraftRequest) {
    return this.request<AIGenerateDraftResponse>('/ai/work-notes/draft-from-text-with-similar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PDF Jobs
  uploadPDF(file: File) {
    return this.uploadFile<PDFJob>('/pdf-jobs', file);
  }

  getPDFJob(jobId: string) {
    return this.request<PDFJob>(`/pdf-jobs/${jobId}`);
  }

  // Projects
  getProjects(filters?: ProjectFilters) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.leaderPersonId) params.set('leaderPersonId', filters.leaderPersonId);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const qs = params.toString();
    return this.request<Project[]>(`/projects${qs ? `?${qs}` : ''}`);
  }

  getProject(projectId: string) {
    return this.request<ProjectDetail>(`/projects/${projectId}`).then((project) => ({
      ...project,
      workNotes: project.workNotes?.map((wn: unknown) => {
        const item = wn as BackendWorkNote & WorkNote;
        if (item.id && item.content) return item;
        const workId = item.workId ?? item.id;
        const contentRaw = item.contentRaw ?? item.content ?? '';
        return this.transformWorkNoteFromBackend({ ...item, workId, contentRaw });
      }),
    }));
  }

  createProject(data: CreateProjectRequest) {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateProject(projectId: string, data: UpdateProjectRequest) {
    return this.request<Project>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteProject(projectId: string) {
    return this.request<void>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  getProjectStats(projectId: string) {
    return this.request<ProjectStats>(`/projects/${projectId}/stats`);
  }

  getProjectTodos(projectId: string) {
    return this.request<Todo[]>(`/projects/${projectId}/todos`);
  }

  // Project Work Notes
  getProjectWorkNotes(projectId: string) {
    return this.request<Array<BackendWorkNote & Partial<WorkNote>>>(
      `/projects/${projectId}/work-notes`
    ).then((items) =>
      items.map((wn) => {
        if ((wn as unknown as WorkNote).content && (wn as unknown as WorkNote).id) {
          return wn as unknown as WorkNote;
        }
        return this.transformWorkNoteFromBackend({
          ...wn,
          workId: wn.workId ?? wn.id,
          contentRaw: wn.contentRaw ?? wn.content ?? '',
        } as BackendWorkNote);
      })
    );
  }

  assignWorkNoteToProject(projectId: string, data: AssignWorkNoteRequest) {
    return this.request<void>(`/projects/${projectId}/work-notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  removeWorkNoteFromProject(projectId: string, workId: string) {
    return this.request<void>(`/projects/${projectId}/work-notes/${workId}`, {
      method: 'DELETE',
    });
  }

  // Project Files
  getProjectFiles(projectId: string) {
    return this.request<ProjectFile[]>(`/projects/${projectId}/files`);
  }

  uploadProjectFile(projectId: string, file: File) {
    return this.uploadFile<ProjectFile>(`/projects/${projectId}/files`, file);
  }

  getProjectFile(projectId: string, fileId: string) {
    return this.request<ProjectFile>(`/projects/${projectId}/files/${fileId}`);
  }

  async downloadProjectFile(projectId: string, fileId: string): Promise<Blob> {
    const headers: Record<string, string> = {};

    // In development, use test auth header
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      headers['X-Test-User-Email'] = 'test@example.com';
    }

    const response = await fetch(`${this.baseURL}/projects/${projectId}/files/${fileId}/download`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`파일 다운로드 실패: ${response.status}`);
    }

    return response.blob();
  }

  deleteProjectFile(projectId: string, fileId: string) {
    return this.request<void>(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  // Admin - Vector Store Management
  getEmbeddingStats() {
    return this.request<EmbeddingStats>('/admin/embedding-stats');
  }

  reindexAll(batchSize?: number) {
    const params = new URLSearchParams();
    if (batchSize) params.set('batchSize', batchSize.toString());
    const queryString = params.toString();
    return this.request<{ success: boolean; message: string; result: BatchProcessResult }>(
      `/admin/reindex-all${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
  }

  reindexOne(workId: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/reindex/${workId}`, {
      method: 'POST',
    });
  }

  embedPending(batchSize?: number) {
    const params = new URLSearchParams();
    if (batchSize) params.set('batchSize', batchSize.toString());
    const queryString = params.toString();
    return this.request<{ success: boolean; message: string; result: BatchProcessResult }>(
      `/admin/embed-pending${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
  }

  // Statistics
  getStatistics(params: StatisticsQueryParams) {
    const queryParams = new URLSearchParams();
    queryParams.set('period', params.period);
    if (params.year) queryParams.set('year', params.year.toString());
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.personId) queryParams.set('personId', params.personId);
    if (params.deptName) queryParams.set('deptName', params.deptName);
    if (params.category) queryParams.set('category', params.category);

    return this.request<WorkNoteStatistics>(`/statistics?${queryParams.toString()}`);
  }
}

export const API = new APIClient();
