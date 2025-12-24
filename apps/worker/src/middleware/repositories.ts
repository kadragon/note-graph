// Trace: SPEC-refactor-repository-di, TASK-REFACTOR-004
/**
 * Repository injection middleware.
 *
 * Creates repository instances per request and attaches them to the Hono context.
 * Each request receives its own set of repository instances to ensure proper isolation
 * and state management.
 *
 * @param c - Hono context with AppContext type, provides access to environment (DB)
 * @param next - Hono next middleware function
 * @returns Promise that resolves to Response or void, following Hono middleware pattern
 *
 * @description
 * **Repository Instantiation:**
 * - Instantiates 7 repositories (departments, pdfJobs, persons, projects, taskCategories, todos)
 * - Creates a special PersonRepository variant with autoCreateDepartment option
 * - All repositories require a valid database connection (c.env.DB)
 *
 * **Error Handling:**
 * - Repository instantiation errors (e.g., invalid DB connection, missing environment)
 * are NOT caught in this middleware
 * - Errors propagate to the global error handler middleware for centralized handling
 * - This design ensures consistent error responses and logging across the application
 * - Failures occur synchronously during instantiation, allowing the error handler
 *   to catch and format them appropriately
 *
 * **When Instantiation Might Fail:**
 * - c.env.DB is undefined or null (missing database binding)
 * - Database connection is invalid or unreachable
 * - Repository constructors encounter validation errors (rare in normal operation)
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
  // Errors during repository instantiation (e.g., invalid DB connection) will propagate
  // to the global error handler middleware, ensuring centralized error handling and
  // consistent error responses across the application. This approach allows the global
  // handler to determine appropriate error formatting and HTTP status codes.
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
