// Trace: SPEC-ai-draft-1, TASK-013
/**
 * AI-powered work note draft generation routes
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../utils/validation';
import { DraftFromTextRequestSchema, TodoSuggestionsRequestSchema } from '../schemas/ai-draft';
import { AIDraftService } from '../services/ai-draft-service';
import { WorkNoteService } from '../services/work-note-service';
import { RateLimitError, NotFoundError } from '../types/errors';

type Variables = {
  user: AuthUser;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All AI draft routes require authentication
app.use('*', authMiddleware);

/**
 * POST /ai/work-notes/draft-from-text
 * Generate work note draft from unstructured text
 */
app.post('/work-notes/draft-from-text', async (c) => {
  try {
    const body = await validateBody(c, DraftFromTextRequestSchema);

    const aiDraftService = new AIDraftService(c.env);
    const draft = await aiDraftService.generateDraftFromText(body.inputText, {
      category: body.category,
      personIds: body.personIds,
      deptName: body.deptName,
    });

    return c.json(draft);
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

/**
 * POST /ai/work-notes/:workId/todo-suggestions
 * Generate todo suggestions for existing work note
 */
app.post('/work-notes/:workId/todo-suggestions', async (c) => {
  try {
    const { workId } = c.req.param();
    const body = await validateBody(c, TodoSuggestionsRequestSchema);

    // Fetch work note
    const workNoteService = new WorkNoteService(c.env);
    const workNote = await workNoteService.findById(workId);

    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    // Generate todo suggestions
    const aiDraftService = new AIDraftService(c.env);
    const todos = await aiDraftService.generateTodoSuggestions(workNote, body.contextText);

    return c.json(todos);
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
