// Trace: SPEC-rag-1, SPEC-refactor-repository-di, TASK-012, TASK-041, TASK-REFACTOR-004

import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { RagQueryRequestSchema } from '../schemas/rag';
import { RagService } from '../services/rag-service';
import { BadRequestError } from '../types/errors';
import { createBufferedSSEResponse } from '../utils/buffered-sse';
import { createProtectedRouter } from './_shared/router-factory';

const app = createProtectedRouter();

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
  // Execute RAG query
  const ragService = new RagService(c.get('db'), c.env, c.get('settingService'));

  return createBufferedSSEResponse(async () => {
    return ragService.query(body.query, {
      scope: body.scope,
      personId: body.personId,
      deptName: body.deptName,
      workId: body.workId,
      topK: body.topK,
    });
  });
});

export default app;
