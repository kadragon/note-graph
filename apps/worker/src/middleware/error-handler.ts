// Trace: SPEC-refactor-error-handler, SPEC-refactor-repository-di, TASK-REFACTOR-002, TASK-REFACTOR-004
/**
 * Global Error Handler Middleware
 *
 * Provides centralized error handling for all routes:
 * - Catches DomainError instances and formats them with appropriate status codes
 * - Logs unexpected errors with structured context
 * - Returns consistent error responses across the application
 */

import type { Context, Next } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from '../types/context';
import { DomainError } from '../types/errors';

/**
 * Error handler middleware
 *
 * Wraps route handlers to catch and format errors consistently.
 * Should be applied at the route level or globally.
 *
 * Usage:
 * ```typescript
 * app.use('*', errorHandler);
 * ```
 */
export function errorHandler(c: Context<AppContext>, next: Next) {
  return next().catch((error: unknown) => {
    // Handle known domain errors
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }

    // Log unexpected errors with context
    console.error('[ERROR]', {
      timestamp: new Date().toISOString(),
      path: c.req.path,
      method: c.req.method,
      user: c.get('user')?.email,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return generic 500 error
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  });
}
