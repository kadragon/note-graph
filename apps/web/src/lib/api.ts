import { CF_ACCESS_CONFIG } from '@web/lib/config';
import { type BackendTodo, transformTodoFromBackend } from '@web/lib/mappers/todo';
import { type BackendWorkNote, transformWorkNoteFromBackend } from '@web/lib/mappers/work-note';
import type {
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
  AssignWorkNoteRequest,
  BatchProcessResult,
  CalendarEventsResponse,
  CreateDepartmentRequest,
  CreatePersonRequest,
  CreateProjectRequest,
  CreateTaskCategoryRequest,
  CreateTodoRequest,
  CreateWorkNoteRequest,
  Department,
  DepartmentSearchResult,
  DriveFileListItem,
  EmbeddingStats,
  GoogleDriveStatus,
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
  SearchRequest,
  SearchResult,
  StatisticsQueryParams,
  TaskCategory,
  Todo,
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
  WorkNoteFileMigrationResult,
  WorkNoteFilesListResponse,
  WorkNoteStatistics,
} from '@web/types/api';

// Trace: SPEC-worknote-attachments-1, TASK-066

/**
 * Custom API error with code for handling specific error types
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Cloudflare Access token refresh utility
 * When CF Access token expires, API calls fail with CORS errors
 * because CF returns a redirect without CORS headers.
 * This utility refreshes the token via a hidden iframe.
 */
class CFAccessTokenRefresher {
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private lastRefreshTime = 0;
  private consecutiveFailures = 0;

  /**
   * Check if browser is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Check if an error is a generic network error (offline, server unreachable)
   */
  isNetworkError(error: unknown): boolean {
    if (!(error instanceof TypeError)) {
      return false;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes('failed to fetch') || message.includes('network') || message.includes('cors')
    );
  }

  /**
   * Check if an error is likely a CF Access CORS error (not a generic network issue)
   * Returns true only if we're online and getting network errors (likely CF Access redirect)
   */
  isCFAccessError(error: unknown): boolean {
    // If offline, it's not a CF Access error - it's a network connectivity issue
    if (!this.isOnline()) {
      return false;
    }
    return this.isNetworkError(error);
  }

  /**
   * Check if we've exceeded retry attempts and should redirect to login
   */
  shouldRedirectToLogin(): boolean {
    // Only redirect if online - offline users should see network error, not login redirect
    return this.isOnline() && this.consecutiveFailures >= CF_ACCESS_CONFIG.MAX_CONSECUTIVE_FAILURES;
  }

  /**
   * Verify that the origin is reachable before forcing auth redirect
   * This prevents redirect loops when the server is down
   *
   * Note: When CF Access token expires, /favicon.ico also returns a CORS error
   * because CF Access protects all routes. Using mode: 'no-cors' allows us to
   * detect that the server is responding (opaque response) even when CORS blocks
   * the actual content.
   */
  async verifyOriginReachable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CF_ACCESS_CONFIG.AUTH_CHECK_TIMEOUT_MS
      );

      // mode: 'no-cors' avoids CORS errors and returns an opaque response
      // when the server responds (even with CF Access redirect)
      const response = await fetch(`${window.location.origin}/favicon.ico`, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If fetch resolves, the server is reachable. Any response (200, 404,
      // or opaque from CF Access redirect) confirms the origin is live.
      // The catch block handles genuine network errors.
      void response;
      return true;
    } catch {
      // With mode: 'no-cors', any error means the server is genuinely unreachable:
      // - AbortError: timeout (server didn't respond in time)
      // - TypeError: DNS failure, connection refused, network down
      // Return false to show "server unreachable" state and avoid redirect loops
      return false;
    }
  }

  /**
   * Force redirect to trigger Cloudflare Access login
   * Clears service worker cache to ensure fresh auth flow
   * Only redirects if we can confirm origin is reachable
   */
  async forceAuthRedirect(): Promise<boolean> {
    // Verify origin is reachable to avoid redirect loop on network outage
    const originReachable = await this.verifyOriginReachable();
    if (!originReachable) {
      // Origin not reachable - this is a network issue, not CF Access
      return false;
    }

    // Unregister service worker to clear cached SPA
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }

    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // Force full page reload to trigger CF Access
    window.location.href = `${window.location.origin}/?auth_redirect=1`;
    return true;
  }

  /**
   * Record a successful API call (resets failure counter)
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Refresh CF Access token using hidden iframe
   * Returns true if refresh might have succeeded, false if it definitely failed
   */
  async refreshToken(): Promise<boolean> {
    const now = Date.now();

    // Prevent rapid refresh attempts
    if (now - this.lastRefreshTime < CF_ACCESS_CONFIG.REFRESH_COOLDOWN_MS) {
      return false;
    }

    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.lastRefreshTime = now;

    this.refreshPromise = new Promise<boolean>((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${window.location.origin}/`;

      let resolved = false;

      const finalCleanup = (success: boolean) => {
        if (resolved) return;
        resolved = true;

        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        this.isRefreshing = false;
        this.refreshPromise = null;

        if (!success) {
          this.consecutiveFailures++;
        }

        resolve(success);
      };

      const fallbackTimeoutId = setTimeout(
        () => finalCleanup(false),
        CF_ACCESS_CONFIG.REFRESH_TIMEOUT_MS
      );

      iframe.onload = () => {
        clearTimeout(fallbackTimeoutId);
        // Give CF Access time to set the cookie
        setTimeout(() => finalCleanup(true), CF_ACCESS_CONFIG.COOKIE_SET_DELAY_MS);
      };

      iframe.onerror = () => {
        clearTimeout(fallbackTimeoutId);
        finalCleanup(false);
      };

      document.body.appendChild(iframe);
    });

    return this.refreshPromise;
  }
}

export const cfTokenRefresher = new CFAccessTokenRefresher();

/**
 * Backend todo response format
 * Maps to D1 database schema
 */
export class APIClient {
  private baseURL = '/api';

  /**
   * Handle CF Access errors with retry logic
   * Returns the retry result if retried, otherwise throws the error
   */
  private async handleCFAccessError<T>(
    error: unknown,
    isRetry: boolean,
    retryFn: () => Promise<T>
  ): Promise<T> {
    if (cfTokenRefresher.isCFAccessError(error)) {
      if (cfTokenRefresher.shouldRedirectToLogin()) {
        await cfTokenRefresher.forceAuthRedirect();
        throw error;
      }

      if (!isRetry) {
        await cfTokenRefresher.refreshToken();
        return retryFn();
      }
    }
    throw error;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const { data } = await this.requestWithHeaders<T>(endpoint, options, isRetry);
    return data;
  }

  private async requestWithHeaders<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<{ data: T; headers: Headers }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      (headers as Record<string, string>)['X-Test-User-Email'] = 'test@example.com';
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({
          message: '알 수 없는 오류가 발생했습니다',
        }))) as { message?: string; code?: string };
        throw new ApiError(error.message || `HTTP ${response.status}`, error.code);
      }

      // Success - reset failure counter
      cfTokenRefresher.recordSuccess();

      if (response.status === 204) {
        return { data: null as T, headers: response.headers };
      }

      return { data: (await response.json()) as T, headers: response.headers };
    } catch (error) {
      return this.handleCFAccessError(error, isRetry, () =>
        this.requestWithHeaders<T>(endpoint, options, true)
      );
    }
  }

  async uploadFile<T>(
    endpoint: string,
    file: File,
    metadata: Record<string, string | undefined> = {},
    isRetry = false
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

    try {
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

      // Success - reset failure counter
      cfTokenRefresher.recordSuccess();

      return response.json() as Promise<T>;
    } catch (error) {
      return this.handleCFAccessError(error, isRetry, () =>
        this.uploadFile<T>(endpoint, file, metadata, true)
      );
    }
  }

  private async _downloadFile(endpoint: string, isRetry = false): Promise<Blob> {
    const headers: Record<string, string> = {};

    // In development, use test auth header
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      headers['X-Test-User-Email'] = 'test@example.com';
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, { headers });

      if (!response.ok) {
        throw new Error(`파일 다운로드 실패: ${response.status}`);
      }

      // Success - reset failure counter
      cfTokenRefresher.recordSuccess();

      return response.blob();
    } catch (error) {
      return this.handleCFAccessError(error, isRetry, () => this._downloadFile(endpoint, true));
    }
  }

  // Auth
  getMe() {
    return this.request<User>('/me');
  }

  // Google Drive Auth
  async getGoogleDriveStatus() {
    const { data, headers } =
      await this.requestWithHeaders<GoogleDriveStatus>('/auth/google/status');
    const configuredHeader = headers.get('X-Google-Drive-Configured');
    const configured = configuredHeader !== 'false';
    const calendarConnected =
      data.scope?.includes('https://www.googleapis.com/auth/calendar.readonly') ?? false;
    return { ...data, configured, calendarConnected };
  }

  async disconnectGoogle() {
    return this.request<void>('/auth/google/disconnect', {
      method: 'POST',
    });
  }

  // Work Notes
  async getWorkNotes() {
    const response = await this.request<BackendWorkNote[]>('/work-notes');
    return response.map((note) => transformWorkNoteFromBackend(note));
  }

  async getWorkNote(workId: string) {
    const response = await this.request<BackendWorkNote>(`/work-notes/${workId}`);
    return transformWorkNoteFromBackend(response);
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
    return transformWorkNoteFromBackend(response);
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
    return transformWorkNoteFromBackend(response);
  }

  deleteWorkNote(workId: string) {
    return this.request<void>(`/work-notes/${workId}`, {
      method: 'DELETE',
    });
  }

  // Work note file operations
  async getWorkNoteFiles(workId: string): Promise<WorkNoteFilesListResponse> {
    return this.request<WorkNoteFilesListResponse>(`/work-notes/${workId}/files`);
  }

  async uploadWorkNoteFile(workId: string, file: File): Promise<DriveFileListItem> {
    return this.uploadFile<DriveFileListItem>(`/work-notes/${workId}/files`, file);
  }

  async migrateWorkNoteFiles(workId: string) {
    return this.request<WorkNoteFileMigrationResult>(`/work-notes/${workId}/files/migrate`, {
      method: 'POST',
    });
  }

  downloadWorkNoteFile(workId: string, fileId: string): Promise<Blob> {
    return this._downloadFile(`/work-notes/${workId}/files/${fileId}/download`);
  }

  async deleteWorkNoteFile(workId: string, fileId: string) {
    return this.request<void>(`/work-notes/${workId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get URL for viewing a work note file inline (for browser preview)
   */
  getWorkNoteFileViewUrl(workId: string, fileId: string): string {
    return `${this.baseURL}/work-notes/${workId}/files/${fileId}/view`;
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
  async getTodos(view: TodoView = 'today', year?: number, workIds?: string[]) {
    const params = new URLSearchParams();
    params.set('view', view);
    if (year) {
      params.set('year', year.toString());
    }
    if (workIds?.length) {
      params.set('workIds', workIds.join(','));
    }
    const response = await this.request<BackendTodo[]>(`/todos?${params.toString()}`);
    return response.map(transformTodoFromBackend.bind(this));
  }

  async updateTodo(todoId: string, data: UpdateTodoRequest) {
    const response = await this.request<BackendTodo>(`/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return transformTodoFromBackend(response);
  }

  deleteTodo(todoId: string) {
    return this.request<void>(`/todos/${todoId}`, {
      method: 'DELETE',
    });
  }

  async createWorkNoteTodo(workId: string, data: CreateTodoRequest) {
    const response = await this.request<BackendTodo>(`/work-notes/${workId}/todos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return transformTodoFromBackend(response);
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
    return this.request<ProjectDetail>(`/projects/${projectId}`);
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
        return transformWorkNoteFromBackend({
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

  downloadProjectFile(projectId: string, fileId: string): Promise<Blob> {
    return this._downloadFile(`/projects/${projectId}/files/${fileId}/download`);
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

  // Calendar
  getCalendarEvents(startDate: string, endDate: string) {
    // Get browser's timezone offset (negate because getTimezoneOffset returns opposite sign)
    const timezoneOffset = -new Date().getTimezoneOffset();
    const params = new URLSearchParams({
      startDate,
      endDate,
      timezoneOffset: timezoneOffset.toString(),
    });
    return this.request<CalendarEventsResponse>(`/calendar/events?${params.toString()}`);
  }
}

export const API = new APIClient();
