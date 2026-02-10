// Trace: SPEC-ai-draft-1, SPEC-ai-draft-refs-1, SPEC-refactor-repository-di, TASK-013, TASK-029, TASK-REFACTOR-004
/**
 * AI-powered work note draft generation routes
 */

import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import {
  DraftFromTextRequestSchema,
  enhanceWorkNoteRequestSchema,
  TodoSuggestionsRequestSchema,
} from '../schemas/ai-draft';
import { AIDraftService } from '../services/ai-draft-service';
import { FileTextExtractionService } from '../services/file-text-extraction-service';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext, AppVariables } from '../types/context';
import { NotFoundError } from '../types/errors';
import type { OpenTodoDueDateContextForAI } from '../types/todo-due-date-context';

// Configuration constants
const SIMILAR_NOTES_TOP_K = 3;

type Variables = {
  activeCategoryNames: string[];
  todoDueDateContext: OpenTodoDueDateContextForAI;
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

const todoDueDateContextMiddleware = async (c: Context<AiDraftContext>, next: Next) => {
  const { todos: todoRepository } = c.get('repositories');
  const todoDueDateContext = await todoRepository.getOpenTodoDueDateContextForAI(10);
  c.set('todoDueDateContext', todoDueDateContext);
  await next();
};

/**
 * POST /ai/work-notes/draft-from-text
 * Generate work note draft from unstructured text
 */
app.post(
  '/work-notes/draft-from-text',
  activeCategoriesMiddleware,
  todoDueDateContextMiddleware,
  bodyValidator(DraftFromTextRequestSchema),
  async (c) => {
    const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
    const activeCategoryNames = c.get('activeCategoryNames');
    const todoDueDateContext = c.get('todoDueDateContext');

    const aiDraftService = new AIDraftService(c.env);
    const draft = await aiDraftService.generateDraftFromText(body.inputText, {
      category: body.category,
      personIds: body.personIds,
      deptName: body.deptName,
      activeCategories: activeCategoryNames,
      todoDueDateContext,
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
  todoDueDateContextMiddleware,
  bodyValidator(DraftFromTextRequestSchema),
  async (c) => {
    const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
    const activeCategoryNames = c.get('activeCategoryNames');
    const todoDueDateContext = c.get('todoDueDateContext');

    // Search for similar work notes using shared service
    const workNoteService = new WorkNoteService(c.env);
    const similarNotes = await workNoteService.findSimilarNotes(
      body.inputText,
      SIMILAR_NOTES_TOP_K
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
            todoDueDateContext,
          })
        : await aiDraftService.generateDraftFromText(body.inputText, {
            category: body.category,
            personIds: body.personIds,
            deptName: body.deptName,
            activeCategories: activeCategoryNames,
            todoDueDateContext,
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
  todoDueDateContextMiddleware,
  bodyValidator(TodoSuggestionsRequestSchema),
  async (c) => {
    const workId = c.req.param('workId');
    const body = getValidatedBody<typeof TodoSuggestionsRequestSchema>(c);
    const todoDueDateContext = c.get('todoDueDateContext');

    // Fetch work note
    const workNoteService = new WorkNoteService(c.env);
    const workNote = await workNoteService.findById(workId);

    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    // Generate todo suggestions
    const aiDraftService = new AIDraftService(c.env);
    const todos = await aiDraftService.generateTodoSuggestions(workNote, body.contextText, {
      todoDueDateContext,
    });

    return c.json(todos);
  }
);

/**
 * POST /ai/work-notes/:workId/enhance
 * Enhance existing work note with new content (text and/or file)
 */
app.post(
  '/work-notes/:workId/enhance',
  activeCategoriesMiddleware,
  todoDueDateContextMiddleware,
  async (c) => {
    const workId = c.req.param('workId');
    const activeCategoryNames = c.get('activeCategoryNames');
    const { todos: todoRepository } = c.get('repositories');
    const todoDueDateContext = c.get('todoDueDateContext');

    // Parse multipart form data
    const formData = await c.req.formData();
    const newContentText = formData.get('newContent') as string | null;
    const generateNewTodosStr = formData.get('generateNewTodos') as string | null;
    const file = formData.get('file') as File | null;

    // Extract text from file if provided
    let extractedText = '';
    if (file) {
      const extractor = new FileTextExtractionService();
      const result = await extractor.extractText(file, file.type);

      if (!result.success) {
        return c.json({ error: result.reason || '파일에서 텍스트를 추출할 수 없습니다.' }, 400);
      }

      extractedText = result.text || '';
    }

    // Combine text input and extracted file text
    const combinedContent = [newContentText || '', extractedText].filter(Boolean).join('\n\n');

    // Validate that we have some content
    const validationResult = enhanceWorkNoteRequestSchema.safeParse({
      newContent: combinedContent,
      generateNewTodos: generateNewTodosStr !== 'false',
    });

    if (!validationResult.success) {
      return c.json({ error: validationResult.error.issues[0]?.message || 'Invalid request' }, 400);
    }

    const { newContent, generateNewTodos } = validationResult.data;

    // Fetch existing work note
    const workNoteService = new WorkNoteService(c.env);
    const workNote = await workNoteService.findById(workId);

    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    // Fetch existing todos
    const existingTodos = await todoRepository.findByWorkId(workId);
    const todoReferences = existingTodos.map((todo) => ({
      title: todo.title,
      description: todo.description,
      status: todo.status,
      dueDate: todo.dueDate,
    }));

    // Find similar notes for context
    const similarNotes = await workNoteService.findSimilarNotes(newContent, SIMILAR_NOTES_TOP_K);

    // Generate enhanced draft
    const aiDraftService = new AIDraftService(c.env);
    const enhancedDraft = await aiDraftService.enhanceExistingWorkNote(
      workNote,
      todoReferences,
      newContent,
      {
        similarNotes,
        activeCategories: activeCategoryNames,
        todoDueDateContext,
      }
    );

    // If generateNewTodos is false, clear the todos array
    if (!generateNewTodos) {
      enhancedDraft.todos = [];
    }

    const references = similarNotes.map((note) => ({
      workId: note.workId,
      title: note.title,
      category: note.category,
      similarityScore: note.similarityScore,
    }));

    return c.json({
      enhancedDraft,
      originalContent: workNote.contentRaw,
      existingTodos: existingTodos.map((todo) => ({
        todoId: todo.todoId,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        dueDate: todo.dueDate,
      })),
      references,
    });
  }
);

export default app;
