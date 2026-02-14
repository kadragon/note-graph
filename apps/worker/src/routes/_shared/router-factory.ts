import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/error-handler';
import type { AppContext } from '../../types/context';

type RouterContext = {
  Bindings: AppContext['Bindings'];
  Variables: AppContext['Variables'];
};

function castMiddleware<T extends RouterContext>(
  middleware: MiddlewareHandler<AppContext>
): MiddlewareHandler<T> {
  return middleware as unknown as MiddlewareHandler<T>;
}

export function createErrorHandledRouter<T extends RouterContext = AppContext>(): Hono<T> {
  const router = new Hono<T>();
  router.use('*', castMiddleware<T>(errorHandler));
  return router;
}

export function createProtectedRouter<T extends RouterContext = AppContext>(): Hono<T> {
  const router = new Hono<T>();
  router.use('*', castMiddleware<T>(authMiddleware));
  router.use('*', castMiddleware<T>(errorHandler));
  return router;
}
