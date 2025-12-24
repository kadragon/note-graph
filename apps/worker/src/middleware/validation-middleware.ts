// Trace: SPEC-refactor-validation-middleware, TASK-REFACTOR-006
/**
 * Validation middleware factories for request body and query params.
 */

import type { Context, Next } from 'hono';
import type { z } from 'zod';
import { validateBody, validateQuery } from '../utils/validation';

type AnyContext = Context;

export function bodyValidator<T extends z.ZodType>(schema: T) {
  return async (c: AnyContext, next: Next) => {
    const body = await validateBody(c, schema);
    c.set('body', body);
    await next();
  };
}

export function queryValidator<T extends z.ZodType>(schema: T) {
  return async (c: AnyContext, next: Next) => {
    const query = validateQuery(c, schema);
    c.set('query', query);
    await next();
  };
}

export function getValidatedBody<T extends z.ZodType>(c: AnyContext, schema: T) {
  void schema;
  return c.get('body') as z.infer<T>;
}

export function getValidatedQuery<T extends z.ZodType>(c: AnyContext, schema: T) {
  void schema;
  return c.get('query') as z.infer<T>;
}
