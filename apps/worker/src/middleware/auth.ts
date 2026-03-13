import { AuthenticationError, type AuthUser } from '@shared/types/auth';
import type { Context, Next } from 'hono';
import type { AppContext } from '../types/context';
import { verifySupabaseJwt } from './supabase-auth';

const CF_ACCESS_EMAIL_HEADER = 'cf-access-authenticated-user-email';
const TEST_USER_EMAIL_HEADER = 'x-test-user-email';
const DEFAULT_DEV_USER_EMAIL = 'dev@localhost';

/**
 * Authentication middleware.
 *
 * Priority:
 * 1. Authorization: Bearer <Supabase JWT>
 * 2. Cf-Access-Authenticated-User-Email (CF Access, transitional)
 * 3. X-Test-User-Email / default (development only)
 */
export async function authMiddleware(c: Context<AppContext>, next: Next) {
  let user: AuthUser | null = null;

  // 1. Try Supabase JWT
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const claims = await verifySupabaseJwt(token, c.env.SUPABASE_URL);
    if (claims) {
      if (
        c.env.ALLOWED_USER_EMAIL &&
        claims.email.toLowerCase() !== c.env.ALLOWED_USER_EMAIL.toLowerCase()
      ) {
        throw new AuthenticationError('Access denied. Unauthorized user.');
      }
      user = {
        email: claims.email.toLowerCase().trim(),
        id: claims.sub,
      };
    }
  }

  // 2. Try CF Access header (transitional)
  if (!user) {
    const cfEmail = c.req.header(CF_ACCESS_EMAIL_HEADER);
    if (cfEmail) {
      user = { email: cfEmail.toLowerCase().trim() };
    }
  }

  // 3. Development fallback
  if (!user && c.env.ENVIRONMENT === 'development') {
    const testEmail = c.req.header(TEST_USER_EMAIL_HEADER) || DEFAULT_DEV_USER_EMAIL;
    user = { email: testEmail.toLowerCase().trim() };
  }

  if (!user) {
    throw new AuthenticationError('Authentication required.');
  }

  c.set('user', user);
  await next();
}

export function getAuthUser(c: Context): AuthUser {
  const user = c.get('user') as AuthUser | undefined;
  if (!user) {
    throw new Error('User not found in context. Ensure authMiddleware is applied.');
  }
  return user;
}
