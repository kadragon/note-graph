// Trace: SPEC-worknote-1, TASK-004
/**
 * Request validation utilities using Zod
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { ValidationError } from '../types/errors';

/**
 * Validate request body against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated and typed data
 * @throws ValidationError if validation fails
 */
export async function validateBody<T extends z.ZodType>(
  c: Context,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body: unknown = await c.req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Request validation failed', error.issues);
    }
    throw error;
  }
}

/**
 * Validate query parameters against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated and typed query parameters
 * @throws ValidationError if validation fails
 */
export function validateQuery<T extends z.ZodType>(
  c: Context,
  schema: T
): z.infer<T> {
  try {
    const query = c.req.query();
    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Query validation failed', error.issues);
    }
    throw error;
  }
}

/**
 * Validate URL parameters against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated and typed parameters
 * @throws ValidationError if validation fails
 */
export function validateParams<T extends z.ZodType>(
  c: Context,
  schema: T
): z.infer<T> {
  try {
    const params = c.req.param();
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Parameter validation failed', error.issues);
    }
    throw error;
  }
}