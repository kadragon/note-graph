// Trace: SPEC-ai-draft-1, SPEC-ai-draft-refs-1, TASK-013, TASK-029
/**
 * AI-powered work note draft generation routes
 */

import type { AuthUser } from '@shared/types/auth';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import { DraftFromTextRequestSchema, TodoSuggestionsRequestSchema } from '../schemas/ai-draft';
import { AIDraftService } from '../services/ai-draft-service';
import { WorkNoteService } from '../services/work-note-service';
import type { Env } from '../types/env';
import { NotFoundError, RateLimitError } from '../types/errors';
import { validateBody } from '../utils/validation';

// Configuration constants
const SIMILAR_NOTES_TOP_K = 3;
const SIMILARITY_SCORE_THRESHOLD = 0.7;

type Variables = {
  user: AuthUser;
  activeCategoryNames: string[];
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All AI draft routes require authentication
app.use('*', authMiddleware);

/**
 * Middleware to fetch active categories for AI suggestion
 * Attaches activeCategoryNames to context for draft generation routes
 */
const activeCategoriesMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const categoryRepo = new TaskCategoryRepository(c.env.DB);
  const activeCategories = await categoryRepo.findAll(undefined, 100, true);
  c.set(
    'activeCategoryNames',
    activeCategories.map((cat) => cat.name)
  );
  await next();
};

/**
 * POST /ai/work-notes/draft-from-text
 * Generate work note draft from unstructured text
 */
app.post('/work-notes/draft-from-text', activeCategoriesMiddleware, async (c) => {
  try {
    const body = await validateBody(c, DraftFromTextRequestSchema);
    const activeCategoryNames = c.get('activeCategoryNames');

    const aiDraftService = new AIDraftService(c.env);
    const draft = await aiDraftService.generateDraftFromText(body.inputText, {
      category: body.category,
      personIds: body.personIds,
      deptName: body.deptName,
      activeCategories: activeCategoryNames,
    });

    return c.json({ draft, references: [] });
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
app.post('/work-notes/draft-from-text-with-similar', activeCategoriesMiddleware, async (c) => {
  try {
    const body = await validateBody(c, DraftFromTextRequestSchema);
    const activeCategoryNames = c.get('activeCategoryNames');

    // Search for similar work notes using shared service
    const workNoteService = new WorkNoteService(c.env);
    const similarNotes = await workNoteService.findSimilarNotes(
      body.inputText,
      SIMILAR_NOTES_TOP_K,
      SIMILARITY_SCORE_THRESHOLD
    );

    // Generate AI draft with similar notes as context
    const aiDraftService = new AIDraftService(c.env);
    const draft =
      similarNotes.length > 0
        ? await aiDraftService.generateDraftFromTextWithContext(body.inputText, similarNotes, {
            category: body.category,
            personIds: body.personIds,
            deptName: body.deptName,
            activeCategories: activeCategoryNames,
          })
        : await aiDraftService.generateDraftFromText(body.inputText, {
            category: body.category,
            personIds: body.personIds,
            deptName: body.deptName,
            activeCategories: activeCategoryNames,
          });

    const references = similarNotes.map((note) => ({
      workId: note.workId,
      title: note.title,
      category: note.category,
      similarityScore: note.similarityScore,
    }));

    return c.json({ draft, references });
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
