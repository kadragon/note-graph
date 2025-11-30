// Trace: SPEC-search-1, TASK-009, TASK-011

import type { Context } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { DepartmentRepository } from '../repositories/department-repository';
import { PersonRepository } from '../repositories/person-repository';
import { searchWorkNotesSchema } from '../schemas/search';
import { HybridSearchService } from '../services/hybrid-search-service';
import type { AuthUser } from '../types/auth';
import type { Env } from '../types/env';
import type {
  DepartmentSearchItem,
  PersonSearchItem,
  UnifiedSearchResponse,
} from '../types/search';
import { validateBody } from '../utils/validation';

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

/**
 * POST /search/unified
 * Unified search across work notes, persons, and departments
 */
search.post('/unified', async (c: Context<{ Bindings: Env }>) => {
  try {
    // Validate request body
    const body = await validateBody(c, searchWorkNotesSchema);
    const query = body.query.trim();

    // Initialize repositories and services
    const hybridSearchService = new HybridSearchService(c.env.DB, c.env);
    const personRepository = new PersonRepository(c.env.DB);
    const departmentRepository = new DepartmentRepository(c.env.DB);

    // Execute searches in parallel
    const [workNoteResults, persons, departments] = await Promise.all([
      // Work notes search (hybrid FTS + Vectorize)
      hybridSearchService.search(query, {
        personId: body.personId,
        deptName: body.deptName,
        category: body.category,
        from: body.from,
        to: body.to,
        limit: body.limit,
      }),
      // Person search
      personRepository.findAll(query),
      // Department search
      departmentRepository.findAll(query),
    ]);

    // Transform person results
    const personResults: PersonSearchItem[] = persons.map((p) => ({
      personId: p.personId,
      name: p.name,
      currentDept: p.currentDept,
      currentPosition: p.currentPosition,
      phoneExt: p.phoneExt,
      employmentStatus: p.employmentStatus,
    }));

    // Transform department results
    const departmentResults: DepartmentSearchItem[] = departments.map((d) => ({
      deptName: d.deptName,
      description: d.description,
      isActive: d.isActive,
    }));

    const response: UnifiedSearchResponse = {
      workNotes: workNoteResults,
      persons: personResults,
      departments: departmentResults,
      query: body.query,
    };

    return c.json(response);
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
