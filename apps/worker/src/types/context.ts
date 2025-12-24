// Trace: SPEC-refactor-repository-di, TASK-REFACTOR-004
/**
 * Shared Hono context types for repository injection.
 */

import type { AuthUser } from '@shared/types/auth';
import type { DepartmentRepository } from '../repositories/department-repository';
import type { PdfJobRepository } from '../repositories/pdf-job-repository';
import type { PersonRepository } from '../repositories/person-repository';
import type { ProjectRepository } from '../repositories/project-repository';
import type { TaskCategoryRepository } from '../repositories/task-category-repository';
import type { TodoRepository } from '../repositories/todo-repository';
import type { Env } from './env';

export interface Repositories {
  departments: DepartmentRepository;
  pdfJobs: PdfJobRepository;
  persons: PersonRepository;
  personsWithAutoCreateDepartment: PersonRepository;
  projects: ProjectRepository;
  taskCategories: TaskCategoryRepository;
  todos: TodoRepository;
}

export interface AppVariables {
  user?: AuthUser;
  repositories: Repositories;
  body?: unknown;
  query?: unknown;
}

export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};
