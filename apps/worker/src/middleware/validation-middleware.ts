// Trace: SPEC-refactor-validation-middleware, TASK-REFACTOR-006
/**
 * Validation middleware factories for request body and query params.
 *
 * This module provides middleware factories for automatic request validation
 * and helper functions to access validated data from the context.
 */

import type { Context, Next } from 'hono';
import type { z } from 'zod';
import { validateBody, validateQuery } from '../utils/validation';

/**
 * Context type for validated requests.
 *
 * Used by validation middleware to store validated body and query parameters
 * on the request context for downstream handlers to access.
 */
type ValidationContext = Context;

/**
 * Middleware factory that validates the request body using the provided schema.
 *
 * @template T - The Zod schema type for body validation
 * @param schema - Zod schema defining the expected request body structure
 * @returns Middleware function that validates body and stores it on context
 *
 * @example
 * ```typescript
 * const createSchema = z.object({ name: z.string() });
 * routes.post('/', bodyValidator(createSchema), async (c) => {
 *   const body = getValidatedBody<typeof createSchema>(c);
 *   // body is strongly typed as { name: string }
 * });
 * ```
 */
export function bodyValidator<T extends z.ZodType>(schema: T) {
  return async (c: ValidationContext, next: Next) => {
    const body = await validateBody(c, schema);
    c.set('body', body);
    await next();
  };
}

/**
 * Middleware factory that validates the query parameters using the provided schema.
 *
 * @template T - The Zod schema type for query validation
 * @param schema - Zod schema defining the expected query parameter structure
 * @returns Middleware function that validates query and stores it on context
 *
 * @example
 * ```typescript
 * const querySchema = z.object({ page: z.string().default('1') });
 * routes.get('/', queryValidator(querySchema), async (c) => {
 *   const query = getValidatedQuery<typeof querySchema>(c);
 *   // query is strongly typed as { page: string }
 * });
 * ```
 */
export function queryValidator<T extends z.ZodType>(schema: T) {
  return async (c: ValidationContext, next: Next) => {
    const query = validateQuery(c, schema);
    c.set('query', query);
    await next();
  };
}

/**
 * Retrieves the validated request body from the context.
 *
 * This helper assumes the validation middleware has already run and stored
 * the validated body on the context. The type parameter allows TypeScript to
 * infer the correct type based on the schema used in the validator.
 *
 * @template T - The Zod schema type (inferred from validator)
 * @param c - The Hono context
 * @returns The validated body with type safety guaranteed by the schema
 *
 * @throws If called without the validation middleware, will throw a helpful error message
 *
 * @example
 * ```typescript
 * // In route handler (after bodyValidator middleware):
 * const body = getValidatedBody<typeof createSchema>(c);
 * ```
 */
export function getValidatedBody<T extends z.ZodType>(c: ValidationContext): z.infer<T> {
  const body = c.get('body');
  if (body === undefined) {
    throw new Error(
      'Validated body not found in context. Did you forget to apply bodyValidator middleware before this handler?'
    );
  }
  return body as z.infer<T>;
}

/**
 * Retrieves the validated query parameters from the context.
 *
 * This helper assumes the validation middleware has already run and stored
 * the validated query parameters on the context. The type parameter allows
 * TypeScript to infer the correct type based on the schema used in the validator.
 *
 * @template T - The Zod schema type (inferred from validator)
 * @param c - The Hono context
 * @returns The validated query parameters with type safety guaranteed by the schema
 *
 * @throws If called without the validation middleware, will throw a helpful error message
 *
 * @example
 * ```typescript
 * // In route handler (after queryValidator middleware):
 * const query = getValidatedQuery<typeof querySchema>(c);
 * ```
 */
export function getValidatedQuery<T extends z.ZodType>(c: ValidationContext): z.infer<T> {
  const query = c.get('query');
  if (query === undefined) {
    throw new Error(
      'Validated query not found in context. Did you forget to apply queryValidator middleware before this handler?'
    );
  }
  return query as z.infer<T>;
}
