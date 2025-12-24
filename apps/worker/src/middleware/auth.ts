// Trace: SPEC-auth-1, SPEC-refactor-repository-di, TASK-003, TASK-REFACTOR-004
/**
 * Authentication middleware for Cloudflare Access
 *
 * Extracts user identity from Cloudflare Access headers:
 * - Cf-Access-Authenticated-User-Email: User's email address
 *
 * For development/testing, falls back to X-Test-User-Email header.
 */

import { AuthenticationError, type AuthUser } from '@shared/types/auth';
import type { Context, Next } from 'hono';
import type { AppContext } from '../types/context';

/**
 * Cloudflare Access authentication header
 */
const CF_ACCESS_EMAIL_HEADER = 'cf-access-authenticated-user-email';

/**
 * Development/testing fallback header
 */
const TEST_USER_EMAIL_HEADER = 'x-test-user-email';

/**
 * Default email for development environment when no headers are present
 */
const DEFAULT_DEV_USER_EMAIL = 'dev@localhost';

/**
 * Authentication middleware
 *
 * Extracts user identity from Cloudflare Access headers and adds it to context.
 * In development mode, allows X-Test-User-Email header for testing.
 * If no headers are present in development mode, uses a default test user.
 *
 * @throws AuthenticationError if no valid authentication header is found in production
 */
export async function authMiddleware(c: Context<AppContext>, next: Next) {
  // Try Cloudflare Access header first
  let email = c.req.header(CF_ACCESS_EMAIL_HEADER);

  // In development, allow test header or default user as fallback
  if (!email && c.env.ENVIRONMENT === 'development') {
    email = c.req.header(TEST_USER_EMAIL_HEADER) || DEFAULT_DEV_USER_EMAIL;
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
  const user = c.get('user') as AuthUser | undefined;
  if (!user) {
    throw new Error('User not found in context. Ensure authMiddleware is applied.');
  }
  return user;
}
