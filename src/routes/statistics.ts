// Trace: SPEC-stats-1, TASK-047
/**
 * Statistics routes for work note completion metrics
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { authMiddleware } from '../middleware/auth';
import { statisticsQuerySchema } from '../schemas/statistics';
import { StatisticsService } from '../services/statistics-service';
import type { Env } from '../types/env';
import { DomainError } from '../types/errors';
import { validateQuery } from '../utils/validation';

const statistics = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All statistics routes require authentication
statistics.use('*', authMiddleware);

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
statistics.get('/', async (c) => {
  try {
    const query = validateQuery(c, statisticsQuerySchema);
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
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }

    console.error('[Statistics] Error getting statistics:', error);
    return c.json(
      {
        code: 'INTERNAL_ERROR',
        message: '통계 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default statistics;
