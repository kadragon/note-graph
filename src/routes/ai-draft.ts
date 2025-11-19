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
import { EmbeddingService, VectorizeService } from '../services/embedding-service';
import { RateLimitError, NotFoundError } from '../types/errors';
import type { WorkNote } from '../types/work-note';

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
 * POST /ai/work-notes/draft-from-text-with-similar
 * Generate work note draft from unstructured text with similar work notes as context
 */
app.post('/work-notes/draft-from-text-with-similar', async (c) => {
  try {
    const body = await validateBody(c, DraftFromTextRequestSchema);

    // Search for similar work notes using vectorize
    const embeddingService = new EmbeddingService(c.env);
    const vectorizeService = new VectorizeService(c.env.VECTORIZE, embeddingService);

    let similarNotes: Array<{ title: string; content: string; category?: string }> = [];
    try {
      // Search for similar work notes (top 3)
      const similarResults = await vectorizeService.search(body.inputText, 3);

      // Fetch work note details from D1
      for (const result of similarResults) {
        const [workId] = result.id.split('#'); // Handle chunk IDs
        const workNote = await c.env.DB
          .prepare(
            `SELECT work_id as workId, title, content_raw as contentRaw, category
             FROM work_notes
             WHERE work_id = ?`
          )
          .bind(workId)
          .first<WorkNote>();

        if (workNote && result.score >= 0.5) {
          similarNotes.push({
            title: workNote.title,
            content: workNote.contentRaw,
            category: workNote.category || undefined,
          });
        }
      }

      // eslint-disable-next-line no-console
      console.log(`[AI Draft] Found ${similarNotes.length} similar work notes for text input`);
    } catch (error) {
      // Log error but continue with draft generation without context
      console.error(`[AI Draft] Error searching for similar notes:`, error);
    }

    // Generate AI draft with similar notes as context
    const aiDraftService = new AIDraftService(c.env);
    const draft = similarNotes.length > 0
      ? await aiDraftService.generateDraftFromTextWithContext(body.inputText, similarNotes, {
          category: body.category,
          personIds: body.personIds,
          deptName: body.deptName,
        })
      : await aiDraftService.generateDraftFromText(body.inputText, {
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
