import type { Context } from 'hono';

export function notFoundJson(c: Context, resource: string, id: string): Response {
  return c.json({ code: 'NOT_FOUND', message: `${resource} not found: ${id}` }, 404);
}

export function missingParamJson(c: Context, paramName: string): Response {
  return c.json({ error: `${paramName} is required` }, 400);
}
