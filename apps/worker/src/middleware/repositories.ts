// Trace: SPEC-refactor-repository-di, TASK-REFACTOR-004
/**
 * Repository injection middleware.
 *
 * Creates repository instances per request and attaches them to context.
 */

import type { Context, Next } from 'hono';
import { DepartmentRepository } from '../repositories/department-repository';
import { PdfJobRepository } from '../repositories/pdf-job-repository';
import { PersonRepository } from '../repositories/person-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import { TodoRepository } from '../repositories/todo-repository';
import type { AppContext, Repositories } from '../types/context';

export async function repositoriesMiddleware(
  c: Context<AppContext>,
  next: Next
): Promise<Response | void> {
  const repositories: Repositories = {
    departments: new DepartmentRepository(c.env.DB),
    pdfJobs: new PdfJobRepository(c.env.DB),
    persons: new PersonRepository(c.env.DB),
    personsWithAutoCreateDepartment: new PersonRepository(c.env.DB, {
      autoCreateDepartment: true,
    }),
    projects: new ProjectRepository(c.env.DB),
    taskCategories: new TaskCategoryRepository(c.env.DB),
    todos: new TodoRepository(c.env.DB),
  };

  c.set('repositories', repositories);

  await next();
}
