import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types/context';

const REFERENCE_DATA_ROUTES = ['/persons', '/departments', '/task-categories', '/work-note-groups'];
const LIST_ROUTES = ['/work-notes'];

export const cacheHeaders: MiddlewareHandler<AppContext> = async (c, next) => {
  await next();

  if (c.req.method !== 'GET') return;
  if (!c.res.ok) return;

  const path = c.req.path.replace(/^\/api/, '');

  if (REFERENCE_DATA_ROUTES.some((route) => path === route)) {
    c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    return;
  }

  if (LIST_ROUTES.some((route) => path === route)) {
    c.header('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');
    return;
  }

  c.header('Cache-Control', 'no-store');
};
