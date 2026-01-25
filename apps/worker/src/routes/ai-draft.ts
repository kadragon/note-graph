// Trace: SPEC-ai-draft-1, SPEC-ai-draft-refs-1, SPEC-refactor-repository-di, TASK-013, TASK-029, TASK-REFACTOR-004
/**
 * AI-powered work note draft generation routes
 */

import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { DraftFromTextRequestSchema, TodoSuggestionsRequestSchema } from '../schemas/ai-draft';
import { AIDraftService } from '../services/ai-draft-service';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext, AppVariables } from '../types/context';
import { NotFoundError } from '../types/errors';

// Configuration constants
const SIMILAR_NOTES_TOP_K = 3;
const SIMILARITY_SCORE_THRESHOLD = 0.4;

type Variables = {
  activeCategoryNames: string[];
} & AppVariables;

type AiDraftContext = { Bindings: AppContext['Bindings']; Variables: Variables };

const app = new Hono<AiDraftContext>();

// All AI draft routes require authentication
app.use('*', authMiddleware);
app.use('*', errorHandler);

/**
 * Middleware to fetch active categories for AI suggestion
 * Attaches activeCategoryNames to context for draft generation routes
 */
const activeCategoriesMiddleware = async (c: Context<AiDraftContext>, next: Next) => {
  const { taskCategories } = c.get('repositories');
  const activeCategories = await taskCategories.findAll(undefined, 100, true);
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
app.post(
  '/work-notes/draft-from-text',
  activeCategoriesMiddleware,
  bodyValidator(DraftFromTextRequestSchema),
  async (c) => {
    const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
    const activeCategoryNames = c.get('activeCategoryNames');

    const aiDraftService = new AIDraftService(c.env);
    const draft = await aiDraftService.generateDraftFromText(body.inputText, {
      category: body.category,
      personIds: body.personIds,
      deptName: body.deptName,
      activeCategories: activeCategoryNames,
    });

    return c.json({ draft, references: [] });
  }
);

/**
 * POST /ai/work-notes/draft-from-text-with-similar
 * Generate work note draft from unstructured text with similar work notes as context
 */
app.post(
  '/work-notes/draft-from-text-with-similar',
  activeCategoriesMiddleware,
  bodyValidator(DraftFromTextRequestSchema),
  async (c) => {
    const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
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
  }
);

/**
 * POST /ai/work-notes/:workId/todo-suggestions
 * Generate todo suggestions for existing work note
 */
app.post(
  '/work-notes/:workId/todo-suggestions',
  bodyValidator(TodoSuggestionsRequestSchema),
  async (c) => {
    const workId = c.req.param('workId');
    const body = getValidatedBody<typeof TodoSuggestionsRequestSchema>(c);

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
  }
);

export default app;
