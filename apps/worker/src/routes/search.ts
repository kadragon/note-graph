// Trace: SPEC-search-1, SPEC-refactor-repository-di, TASK-009, TASK-011, TASK-REFACTOR-004

import type {
  DepartmentSearchItem,
  MeetingMinuteSearchItem,
  PersonSearchItem,
  UnifiedSearchResponse,
} from '@shared/types/search';
import type { Context } from 'hono';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { searchWorkNotesSchema } from '../schemas/search';
import { KeywordSearchService } from '../services/keyword-search-service';
import { MeetingMinuteReferenceService } from '../services/meeting-minute-reference-service';
import type { AppContext } from '../types/context';
import { createProtectedRouter } from './_shared/router-factory';

const search = createProtectedRouter();

/**
 * POST /search/work-notes
 * Search work notes using keyword search (FTS + weighted lexical scoring)
 */
search.post('/work-notes', bodyValidator(searchWorkNotesSchema), async (c: Context<AppContext>) => {
  // Validate request body
  const body = getValidatedBody<typeof searchWorkNotesSchema>(c);

  // Create keyword search service
  const keywordSearchService = new KeywordSearchService(c.get('db'));

  // Execute keyword search
  const results = await keywordSearchService.search(body.query, {
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
    searchType: 'LEXICAL',
  });
});

/**
 * POST /search/unified
 * Unified search across work notes, persons, and departments
 */
search.post('/unified', bodyValidator(searchWorkNotesSchema), async (c: Context<AppContext>) => {
  // Validate request body
  const body = getValidatedBody<typeof searchWorkNotesSchema>(c);
  const query = body.query.trim();

  // Initialize repositories and services
  const db = c.get('db');
  const keywordSearchService = new KeywordSearchService(db);
  const { persons: personRepository, departments: departmentRepository } = c.get('repositories');

  // Execute searches in parallel
  const [workNoteResults, persons, departments, meetingMinutes] = await Promise.all([
    // Work notes search (keyword FTS + weighted lexical scoring)
    keywordSearchService.search(query, {
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
    // Meeting minutes search (FTS)
    (async (): Promise<MeetingMinuteSearchItem[]> => {
      const meetingMinuteReferenceService = new MeetingMinuteReferenceService(db);
      const references = await meetingMinuteReferenceService.search(query, body.limit);
      return references.map((reference) => ({
        ...reference,
        source: 'MEETING_FTS' as const,
      }));
    })(),
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
    meetingMinutes,
    query: body.query,
  };

  return c.json(response);
});

export default search;
