import type { AuthUser } from '@shared/types/auth';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getAuthUser } from '../middleware/auth';

export function getMeHandler(c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>) {
  const user = getAuthUser(c);

  return c.json({
    email: user.email,
    name: user.name || null,
    id: user.id || null,
  });
}
