// Trace: SPEC-rag-1, SPEC-refactor-repository-di, TASK-012, TASK-041, TASK-REFACTOR-004

import { Hono } from 'hono';
import { errorHandler } from '../middleware/error-handler';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { RagQueryRequestSchema } from '../schemas/rag';
import { RagService } from '../services/rag-service';
import type { AppContext } from '../types/context';
import { BadRequestError } from '../types/errors';

const app = new Hono<AppContext>();

app.use('*', errorHandler);

/**
 * POST /rag/query
 * Execute RAG query with contextual retrieval
 */
app.post('/query', bodyValidator(RagQueryRequestSchema), async (c) => {
  // Validate request body
  const body = getValidatedBody<typeof RagQueryRequestSchema>(c);

  // Validate scope-specific requirements
  if (body.scope === 'person' && !body.personId) {
    throw new BadRequestError('personId is required for person scope');
  }
  if (body.scope === 'department' && !body.deptName) {
    throw new BadRequestError('deptName is required for department scope');
  }
  if (body.scope === 'work' && !body.workId) {
    throw new BadRequestError('workId is required for work scope');
  }
  if (body.scope === 'project' && !body.projectId) {
    throw new BadRequestError('projectId is required for project scope');
  }

  // Execute RAG query
  const ragService = new RagService(c.env);

  const result = await ragService.query(body.query, {
    scope: body.scope,
    personId: body.personId,
    deptName: body.deptName,
    workId: body.workId,
    projectId: body.projectId,
    topK: body.topK,
  });

  return c.json(result);
});

export default app;
