// Trace: SPEC-auth-1, TASK-003
/**
 * Authentication API handlers
 */

import type { Context } from 'hono';
import type { Env } from '../index';
import { getAuthUser } from '../middleware/auth';
import type { AuthUser } from '../types/auth';

/**
 * GET /me - Get current authenticated user information
 *
 * Returns the authenticated user's email and name from Cloudflare Access headers.
 *
 * @param c - Hono context with authenticated user
 * @returns User information
 */
export function getMeHandler(c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>) {
  const user = getAuthUser(c);

  return c.json({
    email: user.email,
    name: user.name || null,
  });
}
