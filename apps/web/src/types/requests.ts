import type { AIGatewayLogOrder, AIGatewayLogOrderBy } from '@shared/types/ai-gateway-log';
import type { EmploymentStatus } from '@shared/types/person';
import type { ProjectStatus } from '@shared/types/project';
import type { RagScope } from '@shared/types/search';
import type { StatisticsPeriod } from '@shared/types/statistics';

// Work Note requests
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

// Person requests
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

export interface ImportPersonFromTextRequest {
  text: string;
}

// Department requests
export interface CreateDepartmentRequest {
  deptName: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  description?: string;
  isActive?: boolean;
}

// Task Category requests
export interface CreateTaskCategoryRequest {
  name: string;
}

export interface UpdateTaskCategoryRequest {
  name?: string;
  isActive?: boolean;
}

// Todo requests
import type { CustomIntervalUnit, RecurrenceType, RepeatRule, TodoStatus } from './models/todo';

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

// Search requests
export interface SearchRequest {
  query: string;
}

// RAG requests
export interface RAGQueryRequest {
  query: string;
  scope: RagScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  projectId?: string;
  topK?: number;
}

// AI Draft requests
export interface AIGenerateDraftRequest {
  inputText: string;
  category?: string;
  personIds?: string[];
  deptName?: string;
}

// Project requests
export interface ProjectFilters {
  status?: ProjectStatus;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string;
  startDate?: string;
  deptName?: string;
  participantIds?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string;
  startDate?: string;
  actualEndDate?: string;
  deptName?: string;
}

export interface AssignWorkNoteRequest {
  workId: string;
}

// Statistics requests
export interface StatisticsQueryParams {
  period: StatisticsPeriod;
  year?: number;
  startDate?: string;
  endDate?: string;
  personId?: string;
  deptName?: string;
  category?: string;
}

// AI Gateway logs requests
export interface AIGatewayLogQueryParams {
  page?: number;
  perPage?: number;
  order?: AIGatewayLogOrder;
  orderBy?: AIGatewayLogOrderBy;
  search?: string;
  startDate?: string;
  endDate?: string;
}
