// Trace: SPEC-rag-1, TASK-012
import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { AuthUser } from '../types/auth';
import { RagService } from '../services/rag-service';
import { RagQueryRequestSchema } from '../schemas/rag';
import { validateBody } from '../utils/validation';
import { BadRequestError, RateLimitError } from '../types/errors';

type Variables = {
  user: AuthUser;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /rag/query
 * Execute RAG query with contextual retrieval
 */
app.post('/query', async (c) => {
  // Validate request body
  const body = await validateBody(c, RagQueryRequestSchema);

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
  const ragService = new RagService(c.env);

  try {
    const result = await ragService.query(body.query, {
      scope: body.scope,
      personId: body.personId,
      deptName: body.deptName,
      workId: body.workId,
      topK: body.topK,
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return c.json(
        {
          code: 'AI_RATE_LIMIT',
          message: error.message,
        },
        429
      );
    }
    throw error;
  }
});

export default app;
