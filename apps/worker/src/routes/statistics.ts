// Trace: SPEC-stats-1, SPEC-refactor-repository-di, TASK-047, TASK-REFACTOR-004
/**
 * Statistics routes for work note completion metrics
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { getValidatedQuery, queryValidator } from '../middleware/validation-middleware';
import { statisticsQuerySchema } from '../schemas/statistics';
import { StatisticsService } from '../services/statistics-service';
import type { AppContext } from '../types/context';

const statistics = new Hono<AppContext>();

// All statistics routes require authentication
statistics.use('*', authMiddleware);
statistics.use('*', errorHandler);

/**
 * GET /statistics - Get work note statistics with period filters
 *
 * Query parameters:
 * - period: 'this-week' | 'this-month' | 'first-half' | 'second-half' | 'this-year' | 'last-week' | 'custom'
 * - year: number (optional, for first-half/second-half)
 * - startDate: YYYY-MM-DD (required for custom period)
 * - endDate: YYYY-MM-DD (required for custom period)
 * - personId: string (optional filter)
 * - deptName: string (optional filter)
 * - category: string (optional filter)
 */
statistics.get('/', queryValidator(statisticsQuerySchema), async (c) => {
  const query = getValidatedQuery(c, statisticsQuerySchema);
  const service = new StatisticsService(c.env);

  const stats = await service.getStatistics(query.period, {
    year: query.year,
    startDate: query.startDate,
    endDate: query.endDate,
    personId: query.personId,
    deptName: query.deptName,
    categoryId: query.category,
  });

  return c.json(stats);
});

export default statistics;
