// Trace: SPEC-search-1, TASK-009, TASK-011
import { Hono } from 'hono';
import type { Context } from 'hono';
import { HybridSearchService } from '../services/hybrid-search-service';
import { searchWorkNotesSchema } from '../schemas/search';
import { validateBody } from '../utils/validation';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../types/env';
import type { AuthUser } from '../types/auth';

const search = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// Apply authentication to all search routes
search.use('*', authMiddleware);

/**
 * POST /search/work-notes
 * Search work notes using hybrid search (FTS + Vectorize with RRF)
 */
search.post('/work-notes', async (c: Context<{ Bindings: Env }>) => {
  try {
    // Validate request body
    const body = await validateBody(c, searchWorkNotesSchema);

    // Create hybrid search service
    const hybridSearchService = new HybridSearchService(c.env.DB, c.env);

    // Execute hybrid search (FTS + Vectorize with RRF)
    const results = await hybridSearchService.search(body.query, {
      personId: body.personId,
      deptName: body.deptName,
      category: body.category,
      from: body.from,
      to: body.to,
      limit: body.limit,
    });

    return c.json({
      results,
      count: results.length,
      query: body.query,
      searchType: 'HYBRID',
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json(
        {
          code: 'SEARCH_ERROR',
          message: `검색 중 오류가 발생했습니다: ${error.message}`,
        },
        500
      );
    }
    throw error;
  }
});

export default search;
