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
export type RAGScope = 'global' | 'person' | 'department' | 'work' | 'project';

export interface RAGQueryRequest {
  query: string;
  scope: RAGScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  projectId?: string;
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
  inputText: string;
  category?: string;
  personIds?: string[];
  deptName?: string;
}

export interface AIDraftTodo {
  title: string;
  description?: string;
  dueDate?: string;
}

export interface AIDraftReference {
  workId: string;
  title: string;
  category?: string;
  similarityScore?: number;
}

export interface AIDraftPayload {
  title: string;
  category: string;
  content: string;
  todos: AIDraftTodo[];
}

export interface AIGenerateDraftResponse {
  draft: AIDraftPayload;
  references: AIDraftReference[];
}

// PDF types
export type PDFJobStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';

export interface PDFJob {
  jobId: string;
  status: PDFJobStatus;
  createdAt: string;
  updatedAt: string;
  draft?: AIDraftPayload;
  references?: AIDraftReference[];
  errorMessage?: string;
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

// Project types
export type ProjectStatus = '진행중' | '완료' | '보류' | '중단';
export type ProjectPriority = '높음' | '중간' | '낮음';
export type ProjectParticipantRole = '리더' | '참여자' | '검토자';

export interface ProjectFilters {
  status?: ProjectStatus;
  leaderPersonId?: string;
  startDate?: string;
  endDate?: string;
}

export interface Project {
  projectId: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  tags?: string | null;
  priority?: ProjectPriority | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
  leaderPersonId?: string | null;
  deptName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProjectParticipant {
  id: number;
  projectId: string;
  personId: string;
  role: ProjectParticipantRole;
  joinedAt: string;
  personName?: string;
}

export interface ProjectFile {
  fileId: string;
  projectId: string;
  r2Key: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  embeddedAt?: string | null;
  deletedAt?: string | null;
}

export interface ProjectStats {
  totalTodos: number;
  completedTodos: number;
  pendingTodos: number;
  onHoldTodos: number;
  fileCount: number;
  totalFileSize: number;
}

export interface ProjectDetail extends Project {
  participants?: ProjectParticipant[];
  workNotes?: WorkNote[];
  files?: ProjectFile[];
  stats?: ProjectStats;
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
export type StatisticsPeriod =
  | 'this-week'
  | 'this-month'
  | 'first-half'
  | 'second-half'
  | 'this-year'
  | 'last-week';

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

export interface CategoryDistribution {
  /** Category ID from task_categories table (used for filtering/grouping) */
  categoryId: string | null;
  /** Human-readable category name (used for UI display) */
  categoryName: string | null;
  /** Number of work notes in this category */
  count: number;
}

export interface PersonDistribution {
  personId: string;
  personName: string;
  currentDept: string | null;
  count: number;
}

export interface DepartmentDistribution {
  deptName: string | null;
  count: number;
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
