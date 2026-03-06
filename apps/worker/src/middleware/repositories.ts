// Trace: SPEC-refactor-repository-di, SPEC-rag-2, TASK-REFACTOR-004, TASK-069
/**
 * Repository injection middleware.
 *
 * Creates repository instances per request and attaches them to the Hono context.
 * Each request receives its own set of repository instances to ensure proper isolation
 * and state management.
 *
 * @param c - Hono context with AppContext type, provides access to environment (HYPERDRIVE)
 * @param next - Hono next middleware function
 * @returns Promise that resolves to Response or void, following Hono middleware pattern
 *
 * @description
 * **Repository Instantiation:**
 * - Instantiates repositories (departments, embeddingRetryQueue, pdfJobs, persons, taskCategories, todos, workNoteGroups)
 * - Creates a special PersonRepository variant with autoCreateDepartment option
 * - All repositories require a valid database connection via Hyperdrive
 *
 * **Error Handling:**
 * - Repository instantiation errors (e.g., missing HYPERDRIVE binding, invalid connection)
 * are NOT caught in this middleware
 * - Errors propagate to the global error handler middleware for centralized handling
 * - This design ensures consistent error responses and logging across the application
 * - Failures occur synchronously during instantiation, allowing the error handler
 *   to catch and format them appropriately
 *
 * **When Instantiation Might Fail:**
 * - c.env.HYPERDRIVE is undefined or null (missing Hyperdrive binding)
 * - Database connection is invalid or unreachable
 * - Repository constructors encounter validation errors (rare in normal operation)
 */

import type { Context, Next } from 'hono';
import { createDatabaseClient, createFtsDialect } from '../adapters/database-factory';
import { DepartmentRepository } from '../repositories/department-repository';
import { EmbeddingRetryQueueRepository } from '../repositories/embedding-retry-queue-repository';
import { PdfJobRepository } from '../repositories/pdf-job-repository';
import { PersonRepository } from '../repositories/person-repository';
import { SettingRepository } from '../repositories/setting-repository';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import { TodoRepository } from '../repositories/todo-repository';
import { WorkNoteGroupRepository } from '../repositories/work-note-group-repository';
import { SettingService } from '../services/setting-service';
import type { AppContext, Repositories } from '../types/context';

export async function repositoriesMiddleware(c: Context<AppContext>, next: Next): Promise<void> {
  const db = createDatabaseClient(c.env);
  c.set('db', db);
  c.set('ftsDialect', createFtsDialect(c.env));

  const repositories: Repositories = {
    departments: new DepartmentRepository(db),
    embeddingRetryQueue: new EmbeddingRetryQueueRepository(db),
    pdfJobs: new PdfJobRepository(db),
    persons: new PersonRepository(db),
    personsWithAutoCreateDepartment: new PersonRepository(db, {
      autoCreateDepartment: true,
    }),
    settings: new SettingRepository(db),
    taskCategories: new TaskCategoryRepository(db),
    todos: new TodoRepository(db),
    workNoteGroups: new WorkNoteGroupRepository(db),
  };

  c.set('repositories', repositories);

  const settingService = new SettingService(repositories.settings);
  await settingService.preload();
  c.set('settingService', settingService);

  try {
    await next();
  } finally {
    await db.close?.();
  }
}
