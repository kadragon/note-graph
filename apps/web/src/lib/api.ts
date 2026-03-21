import { type BackendTodo, transformTodoFromBackend } from '@web/lib/mappers/todo';
import { type BackendWorkNote, transformWorkNoteFromBackend } from '@web/lib/mappers/work-note';
import { supabase } from '@web/lib/supabase';
import type {
  AIGatewayLogQueryParams,
  AIGatewayLogsResponse,
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
  AppSetting,
  BatchProcessResult,
  CalendarEventsResponse,
  CreateDepartmentRequest,
  CreatePersonRequest,
  CreateTaskCategoryRequest,
  CreateTodoRequest,
  CreateWorkNoteGroupRequest,
  CreateWorkNoteRequest,
  DailyReport,
  Department,
  DepartmentSearchResult,
  DriveFileListItem,
  EmbeddingStats,
  EnhanceWorkNoteRequest,
  EnhanceWorkNoteResponse,
  GoogleDriveStatus,
  ImportPersonFromTextRequest,
  ImportPersonResponse,
  OpenAIModel,
  ParsedPersonData,
  PDFJob,
  Person,
  PersonDeptHistory,
  PersonSearchResult,
  RAGQueryRequest,
  RAGResponse,
  SearchRequest,
  SearchResult,
  StatisticsQueryParams,
  TaskCategory,
  TodoView,
  UnifiedSearchResult,
  UpdateDepartmentRequest,
  UpdatePersonRequest,
  UpdateTaskCategoryRequest,
  UpdateTodoRequest,
  UpdateWorkNoteGroupRequest,
  UpdateWorkNoteRequest,
  User,
  WorkNoteFileMigrationResult,
  WorkNoteFilesListResponse,
  WorkNoteGroup,
  WorkNoteGroupWorkNote,
  WorkNoteStatistics,
} from '@web/types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export class APIClient {
  private baseURL = '/api';

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
    const authHeaders = await getAuthHeaders();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401 && !isRetry) {
        const { error } = await supabase.auth.refreshSession();
        if (!error) {
          return this.requestWithHeaders<T>(endpoint, options, true);
        }
      }

      if (!response.ok) {
        const error = (await response.json().catch(() => ({
          message: '알 수 없는 오류가 발생했습니다',
        }))) as { message?: string; code?: string };
        throw new ApiError(error.message || `HTTP ${response.status}`, error.code);
      }

      if (response.status === 204) {
        return { data: null as T, headers: response.headers };
      }

      return { data: (await response.json()) as T, headers: response.headers };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw error;
    }
  }

  /**
   * Fetch a buffered SSE endpoint that sends heartbeat comments followed by a
   * single JSON `data:` event and an `event: done` marker.
   */
  private async fetchBufferedSSE<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const authHeaders = await getAuthHeaders();
    const headers: HeadersInit = {
      ...(!options.body || typeof options.body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...authHeaders,
      ...options.headers,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && !isRetry) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        return this.fetchBufferedSSE<T>(endpoint, options, true);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      let message = `HTTP ${response.status}`;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(text) as { message?: string; code?: string };
        if (parsed.message) message = parsed.message;
        code = parsed.code;
      } catch {
        // non-JSON error body
      }
      throw new ApiError(message, code);
    }

    if (!response.body) {
      throw new ApiError('응답에 내용이 없습니다.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: T | undefined;
    let streamError: string | null = null;
    let currentEventType: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (line === '' || line.startsWith(':')) {
          currentEventType = null;
          continue;
        }
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7);
          continue;
        }
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (currentEventType === 'error') {
            try {
              const errData = JSON.parse(payload) as { message?: string };
              streamError = errData.message ?? 'AI 요청 실패';
            } catch {
              streamError = payload;
            }
            continue;
          }
          if (currentEventType === 'done') {
            continue;
          }
          // Main result payload (no event type prefix)
          try {
            result = JSON.parse(payload) as T;
          } catch {
            streamError = 'AI 응답을 파싱할 수 없습니다.';
          }
        }
      }
    }

    if (streamError) {
      throw new ApiError(streamError);
    }
    if (result === undefined) {
      throw new ApiError('AI 응답을 받지 못했습니다.');
    }
    return result;
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

    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    if (response.status === 401 && !isRetry) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        return this.uploadFile<T>(endpoint, file, metadata, true);
      }
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: '업로드 실패',
      }))) as { message?: string };
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private async _downloadFile(endpoint: string, isRetry = false): Promise<Blob> {
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${this.baseURL}${endpoint}`, { headers: authHeaders });

    if (response.status === 401 && !isRetry) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        return this._downloadFile(endpoint, true);
      }
    }

    if (!response.ok) {
      throw new Error(`파일 다운로드 실패: ${response.status}`);
    }

    return response.blob();
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
    return { ...data, configured };
  }

  async storeProviderTokens(accessToken: string, refreshToken: string | null) {
    return this.request<{ success: boolean }>('/auth/google/store-tokens', {
      method: 'POST',
      body: JSON.stringify({ accessToken, refreshToken }),
    });
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
    const { content, relatedPersonIds, relatedWorkIds, groupIds, ...rest } = data;

    const payload: Record<string, unknown> = {
      ...rest,
      contentRaw: content,
    };

    if (groupIds !== undefined) {
      payload.groupIds = groupIds;
    }

    this.appendRelationPayload(payload, relatedPersonIds, relatedWorkIds);

    const response = await this.request<BackendWorkNote>('/work-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return transformWorkNoteFromBackend(response);
  }

  async updateWorkNote(workId: string, data: UpdateWorkNoteRequest) {
    const { content, relatedPersonIds, relatedWorkIds, groupIds, ...rest } = data;

    const payload: Record<string, unknown> = { ...rest };

    if (content !== undefined) {
      payload.contentRaw = content;
    }

    if (groupIds !== undefined) {
      payload.groupIds = groupIds;
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

  getWorkNoteFileViewUrl(workId: string, fileId: string): string {
    return `${this.baseURL}/work-notes/${workId}/files/${fileId}/view`;
  }

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

  private buildQueryString(params: object): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(
      params as Record<string, string | number | boolean | null | undefined>
    )) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    }

    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
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
    const queryString = this.buildQueryString({
      q: params?.q,
      limit: params?.limit,
    });
    return this.request<Department[]>(`/departments${queryString}`, { signal });
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
    const queryString = this.buildQueryString({
      activeOnly: activeOnly ? 'true' : undefined,
    });
    return this.request<TaskCategory[]>(`/task-categories${queryString}`);
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

  // Work Note Groups
  getWorkNoteGroups(activeOnly?: boolean) {
    const queryString = this.buildQueryString({
      activeOnly: activeOnly ? 'true' : undefined,
    });
    return this.request<WorkNoteGroup[]>(`/work-note-groups${queryString}`);
  }

  createWorkNoteGroup(data: CreateWorkNoteGroupRequest) {
    return this.request<WorkNoteGroup>('/work-note-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateWorkNoteGroup(groupId: string, data: UpdateWorkNoteGroupRequest) {
    return this.request<WorkNoteGroup>(`/work-note-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteWorkNoteGroup(groupId: string) {
    return this.request<void>(`/work-note-groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  toggleWorkNoteGroupActive(groupId: string) {
    return this.request<WorkNoteGroup>(`/work-note-groups/${groupId}/toggle-active`, {
      method: 'PATCH',
    });
  }

  getWorkNoteGroupWorkNotes(groupId: string) {
    return this.request<WorkNoteGroupWorkNote[]>(`/work-note-groups/${groupId}/work-notes`);
  }

  addWorkNoteToGroup(groupId: string, workId: string) {
    return this.request<void>(`/work-note-groups/${groupId}/work-notes/${workId}`, {
      method: 'POST',
    });
  }

  removeWorkNoteFromGroup(groupId: string, workId: string) {
    return this.request<void>(`/work-note-groups/${groupId}/work-notes/${workId}`, {
      method: 'DELETE',
    });
  }

  // Meeting Minutes
  getMeetingMinutes(params?: {
    q?: string;
    meetingDateFrom?: string;
    meetingDateTo?: string;
    categoryId?: string;
    groupId?: string;
    attendeePersonId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const queryString = this.buildQueryString({
      q: params?.q,
      meetingDateFrom: params?.meetingDateFrom,
      meetingDateTo: params?.meetingDateTo,
      categoryId: params?.categoryId,
      groupId: params?.groupId,
      attendeePersonId: params?.attendeePersonId,
      page: params?.page,
      pageSize: params?.pageSize,
    });

    return this.request<{
      items: Array<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        detailsRaw: string;
        keywords: string[];
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    }>(`/meeting-minutes${queryString}`);
  }

  createMeetingMinute(data: {
    meetingDate: string;
    topic: string;
    detailsRaw: string;
    attendeePersonIds: string[];
    categoryIds?: string[];
    groupIds?: string[];
  }) {
    return this.request<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywords: string[];
      attendees: Array<{ personId: string; name: string }>;
      categories: Array<{ categoryId: string; name: string }>;
      groups: Array<{ groupId: string; name: string }>;
      createdAt: string;
      updatedAt: string;
    }>('/meeting-minutes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getMeetingMinute(meetingId: string) {
    return this.request<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywords: string[];
      attendees: Array<{ personId: string; name: string }>;
      categories: Array<{ categoryId: string; name: string }>;
      groups: Array<{ groupId: string; name: string }>;
      linkedWorkNoteCount?: number;
      createdAt: string;
      updatedAt: string;
    }>(`/meeting-minutes/${meetingId}`);
  }

  updateMeetingMinute(
    meetingId: string,
    data: {
      meetingDate?: string;
      topic?: string;
      detailsRaw?: string;
      attendeePersonIds?: string[];
      categoryIds?: string[];
      groupIds?: string[];
    }
  ) {
    return this.request<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywords: string[];
      attendees: Array<{ personId: string; name: string }>;
      categories: Array<{ categoryId: string; name: string }>;
      groups: Array<{ groupId: string; name: string }>;
      createdAt: string;
      updatedAt: string;
    }>(`/meeting-minutes/${meetingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteMeetingMinute(meetingId: string) {
    return this.request<void>(`/meeting-minutes/${meetingId}`, {
      method: 'DELETE',
    });
  }

  suggestMeetingMinutes(data: { query: string; limit?: number }) {
    return this.request<{
      meetingReferences: Array<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        keywords: string[];
        score: number;
      }>;
    }>('/meeting-minutes/suggest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Todos
  async getTodos(view: TodoView = 'today', year?: number, workIds?: string[]) {
    const queryString = this.buildQueryString({
      view,
      year,
      workIds: workIds?.length ? workIds.join(',') : undefined,
    });
    const response = await this.request<BackendTodo[]>(`/todos${queryString}`);
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

  batchPostponeTodos(todoIds: string[], amount: number, unit: 'day' | 'week' | 'month') {
    return this.request<{ updatedCount: number; skippedCount: number }>('/todos/batch-postpone', {
      method: 'PATCH',
      body: JSON.stringify({ todoIds, amount, unit }),
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

    if (
      !response ||
      !Array.isArray(response.workNotes) ||
      !Array.isArray(response.persons) ||
      !Array.isArray(response.departments)
    ) {
      throw new Error('Invalid search response from server');
    }

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
    return this.fetchBufferedSSE<RAGResponse>('/rag/query', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // AI Draft
  generateDraft(data: AIGenerateDraftRequest) {
    return this.fetchBufferedSSE<AIGenerateDraftResponse>('/ai/work-notes/draft-from-text', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  generateDraftWithSimilar(data: AIGenerateDraftRequest) {
    return this.fetchBufferedSSE<AIGenerateDraftResponse>(
      '/ai/work-notes/draft-from-text-with-similar',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  enhanceWorkNote(workId: string, data: EnhanceWorkNoteRequest): Promise<EnhanceWorkNoteResponse> {
    const formData = new FormData();
    formData.append('newContent', data.newContent);
    formData.append('generateNewTodos', String(data.generateNewTodos ?? true));

    if (data.file) {
      formData.append('file', data.file);
    }

    return this.fetchBufferedSSE<EnhanceWorkNoteResponse>(`/ai/work-notes/${workId}/enhance`, {
      method: 'POST',
      body: formData,
    });
  }

  // AI Email Reply (SSE streaming)
  async generateEmailReply(
    workId: string,
    data: { assigneeName: string; assigneePosition?: string; assigneeDept?: string },
    isRetry = false
  ): Promise<{ subject: string; body: string }> {
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${this.baseURL}/ai/work-notes/${workId}/email-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(data),
    });

    if (response.status === 401 && !isRetry) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        return this.generateEmailReply(workId, data, true);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      let message = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // non-JSON error body
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('AI 응답에 내용이 없습니다. 다시 시도해주세요.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let streamError: string | null = null;
    let currentEventType: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (line === '') {
          currentEventType = null;
          continue;
        }
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7);
          continue;
        }
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (currentEventType === 'error') {
            try {
              const errData = JSON.parse(payload) as { message?: string };
              streamError = errData.message ?? 'AI 이메일 생성 실패';
            } catch {
              streamError = payload;
            }
            continue;
          }
          if (currentEventType === 'done') {
            continue;
          }
          try {
            accumulated += JSON.parse(payload) as string;
          } catch {
            // skip unparseable token
          }
        }
      }
    }

    if (streamError) {
      throw new Error(streamError);
    }

    try {
      return JSON.parse(accumulated) as { subject: string; body: string };
    } catch {
      throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
    }
  }

  // PDF Jobs
  uploadPDF(file: File) {
    return this.uploadFile<PDFJob>('/pdf-jobs', file);
  }

  getPDFJob(jobId: string) {
    return this.request<PDFJob>(`/pdf-jobs/${jobId}`);
  }

  // Admin - Vector Store Management
  getEmbeddingStats() {
    return this.request<EmbeddingStats>('/admin/embedding-stats');
  }

  getAIGatewayLogs(params: AIGatewayLogQueryParams = {}) {
    const queryString = this.buildQueryString(params);
    return this.request<AIGatewayLogsResponse>(`/admin/ai-gateway/logs${queryString}`);
  }

  reindexAll(batchSize?: number) {
    const queryString = this.buildQueryString({
      batchSize,
    });
    return this.request<{ success: boolean; message: string; result: BatchProcessResult }>(
      `/admin/reindex-all${queryString}`,
      { method: 'POST' }
    );
  }

  reindexOne(workId: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/reindex/${workId}`, {
      method: 'POST',
    });
  }

  embedPending(batchSize?: number) {
    const queryString = this.buildQueryString({
      batchSize,
    });
    return this.request<{ success: boolean; message: string; result: BatchProcessResult }>(
      `/admin/embed-pending${queryString}`,
      { method: 'POST' }
    );
  }

  // Statistics
  getStatistics(params: StatisticsQueryParams) {
    const queryString = this.buildQueryString({
      period: params.period,
      year: params.year,
      startDate: params.startDate,
      endDate: params.endDate,
      personId: params.personId,
      deptName: params.deptName,
      category: params.category,
    });
    return this.request<WorkNoteStatistics>(`/statistics${queryString}`);
  }

  // Settings
  getSettings(category?: string) {
    const queryString = this.buildQueryString({ category });
    return this.request<AppSetting[]>(`/settings${queryString}`);
  }

  getSetting(key: string) {
    return this.request<AppSetting>(`/settings/${key}`);
  }

  updateSetting(key: string, data: { value: string }) {
    return this.request<AppSetting>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  resetSetting(key: string) {
    return this.request<AppSetting>(`/settings/${key}/reset`, {
      method: 'POST',
    });
  }

  getOpenAIModels() {
    return this.request<OpenAIModel[]>('/settings/openai-models');
  }

  // Daily Reports
  getDailyReport(date: string) {
    return this.request<DailyReport>(`/daily-reports/${date}`);
  }

  getDailyReports(limit = 7) {
    const queryString = this.buildQueryString({ limit });
    return this.request<DailyReport[]>(`/daily-reports${queryString}`);
  }

  generateDailyReport(date: string) {
    const timezoneOffset = -new Date().getTimezoneOffset();
    return this.fetchBufferedSSE<DailyReport>('/daily-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ date, timezoneOffset }),
    });
  }

  // Calendar
  getCalendarEvents(startDate: string, endDate: string) {
    const timezoneOffset = -new Date().getTimezoneOffset();
    const queryString = this.buildQueryString({
      startDate,
      endDate,
      timezoneOffset,
    });
    return this.request<CalendarEventsResponse>(`/calendar/events${queryString}`);
  }
}

export const API = new APIClient();
