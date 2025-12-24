// Trace: SPEC-search-1, SPEC-refactor-repository-di, TASK-009, TASK-011, TASK-REFACTOR-004

import type {
  DepartmentSearchItem,
  PersonSearchItem,
  UnifiedSearchResponse,
} from '@shared/types/search';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { searchWorkNotesSchema } from '../schemas/search';
import { HybridSearchService } from '../services/hybrid-search-service';
import type { AppContext } from '../types/context';

const search = new Hono<AppContext>();

// Apply authentication to all search routes
search.use('*', authMiddleware);

// Apply error handler to all search routes
search.use('*', errorHandler);

/**
 * POST /search/work-notes
 * Search work notes using hybrid search (FTS + Vectorize with RRF)
 */
search.post('/work-notes', bodyValidator(searchWorkNotesSchema), async (c: Context<AppContext>) => {
  // Validate request body
  const body = getValidatedBody(c, searchWorkNotesSchema);

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
});

/**
 * POST /search/unified
 * Unified search across work notes, persons, and departments
 */
search.post('/unified', bodyValidator(searchWorkNotesSchema), async (c: Context<AppContext>) => {
  // Validate request body
  const body = getValidatedBody(c, searchWorkNotesSchema);
  const query = body.query.trim();

  // Initialize repositories and services
  const hybridSearchService = new HybridSearchService(c.env.DB, c.env);
  const { persons: personRepository, departments: departmentRepository } = c.get('repositories');

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
});

export default search;
