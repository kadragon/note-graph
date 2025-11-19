// Trace: SPEC-auth-1, TASK-003
/**
 * Authentication middleware for Cloudflare Access
 *
 * Extracts user identity from Cloudflare Access headers:
 * - Cf-Access-Authenticated-User-Email: User's email address
 *
 * For development/testing, falls back to X-Test-User-Email header.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../index';
import { AuthenticationError, type AuthUser } from '../types/auth';

/**
 * Cloudflare Access authentication header
 */
const CF_ACCESS_EMAIL_HEADER = 'cf-access-authenticated-user-email';

/**
 * Development/testing fallback header
 */
const TEST_USER_EMAIL_HEADER = 'x-test-user-email';

/**
 * Authentication middleware
 *
 * Extracts user identity from Cloudflare Access headers and adds it to context.
 * In development mode, allows X-Test-User-Email header for testing.
 * If no headers are present in development mode, uses a default test user (dev@localhost).
 *
 * @throws AuthenticationError if no valid authentication header is found in production
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>,
  next: Next
) {
  // Try Cloudflare Access header first
  let email = c.req.header(CF_ACCESS_EMAIL_HEADER);

  // In development, allow test header as fallback
  if (!email && c.env.ENVIRONMENT === 'development') {
    email = c.req.header(TEST_USER_EMAIL_HEADER);

    // If still no email in development, use default test user
    if (!email) {
      email = 'dev@localhost';
    }
  }

  if (!email) {
    throw new AuthenticationError('Authentication required. Missing Cloudflare Access headers.');
  }

  // Create auth user object
  const user: AuthUser = {
    email: email.toLowerCase().trim(),
    // Name can be extracted from JWT claims if needed in the future
    name: undefined,
  };

  // Add user to context variables
  c.set('user', user);

  await next();
}

/**
 * Get authenticated user from context
 *
 * @param c - Hono context
 * @returns Authenticated user
 * @throws Error if user is not set in context (middleware not applied)
 */
export function getAuthUser(c: Context): AuthUser {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not found in context. Ensure authMiddleware is applied.');
  }
  return user;
}
