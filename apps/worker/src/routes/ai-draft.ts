// Trace: SPEC-ai-draft-1, SPEC-ai-draft-refs-1, SPEC-refactor-repository-di, TASK-013, TASK-029, TASK-REFACTOR-004
/**
 * AI-powered work note draft generation routes
 */

import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { MeetingMinuteRepository } from '../repositories/meeting-minute-repository';
import {
  DraftFromTextRequestSchema,
  enhanceWorkNoteRequestSchema,
  RefineMeetingMinuteRequestSchema,
  TodoSuggestionsRequestSchema,
} from '../schemas/ai-draft';
import { AIDraftService } from '../services/ai-draft-service';
import { FileTextExtractionService } from '../services/file-text-extraction-service';
import { MeetingMinuteReferenceService } from '../services/meeting-minute-reference-service';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext } from '../types/context';
import { NotFoundError } from '../types/errors';
import { createProtectedRouter } from './_shared/router-factory';

// Configuration constants
const SIMILAR_NOTES_TOP_K = 3;
const MEETING_REFERENCES_TOP_K = 5;
const MEETING_REFERENCES_MIN_SCORE = 0.3;

const app = createProtectedRouter<AppContext>();

/**
 * POST /ai/work-notes/draft-from-text
 * Generate work note draft from unstructured text
 */
app.post('/work-notes/draft-from-text', bodyValidator(DraftFromTextRequestSchema), async (c) => {
  const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
  const { taskCategories, todos: todoRepository } = c.get('repositories');

  const [activeCategories, todoDueDateContext] = await Promise.all([
    taskCategories.findAll(undefined, 100, true),
    todoRepository.getOpenTodoDueDateContextForAI(10),
  ]);
  const activeCategoryNames = activeCategories.map((cat) => cat.name);

  const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
  const draft = await aiDraftService.generateDraftFromText(body.inputText, {
    category: body.category,
    personIds: body.personIds,
    deptName: body.deptName,
    activeCategories: activeCategoryNames,
    todoDueDateContext,
  });

  return c.json({ draft, references: [] });
});

/**
 * POST /ai/work-notes/draft-from-text-with-similar
 * Generate work note draft from unstructured text with similar work notes as context
 */
app.post(
  '/work-notes/draft-from-text-with-similar',
  bodyValidator(DraftFromTextRequestSchema),
  async (c) => {
    const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
    const { taskCategories, todos: todoRepository } = c.get('repositories');
    const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));
    const meetingMinuteReferenceService = new MeetingMinuteReferenceService(c.get('db'));

    const [activeCategories, todoDueDateContext, similarNotes, scoredMeetingReferences] =
      await Promise.all([
        taskCategories.findAll(undefined, 100, true),
        todoRepository.getOpenTodoDueDateContextForAI(10),
        workNoteService.findSimilarNotes(body.inputText, SIMILAR_NOTES_TOP_K),
        meetingMinuteReferenceService
          .search(body.inputText, MEETING_REFERENCES_TOP_K, MEETING_REFERENCES_MIN_SCORE)
          .catch((error) => {
            console.error('[ai-draft] Meeting minute reference search failed:', error);
            return [] as Awaited<ReturnType<MeetingMinuteReferenceService['search']>>;
          }),
      ]);
    const activeCategoryNames = activeCategories.map((cat) => cat.name);

    // Generate AI draft with similar notes as context
    const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
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

    return c.json({
      draft,
      references,
      meetingReferences: scoredMeetingReferences,
    });
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
    const workId = c.req.param('workId')!;
    const body = getValidatedBody<typeof TodoSuggestionsRequestSchema>(c);
    const { todos: todoRepository } = c.get('repositories');

    const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));

    const [workNote, todoDueDateContext] = await Promise.all([
      workNoteService.findById(workId),
      todoRepository.getOpenTodoDueDateContextForAI(10),
    ]);

    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
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
app.post('/work-notes/:workId/enhance', async (c) => {
  const workId = c.req.param('workId')!;
  const { taskCategories, todos: todoRepository } = c.get('repositories');

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

  const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));

  // Parallelize: fetch work note, todos, categories, due date context
  const [workNote, existingTodos, activeCategories, todoDueDateContext] = await Promise.all([
    workNoteService.findById(workId),
    todoRepository.findByWorkId(workId),
    taskCategories.findAll(undefined, 100, true),
    todoRepository.getOpenTodoDueDateContextForAI(10),
  ]);

  if (!workNote) {
    throw new NotFoundError('Work note', workId);
  }

  const activeCategoryNames = activeCategories.map((cat) => cat.name);
  const todoReferences = existingTodos.map((todo) => ({
    title: todo.title,
    description: todo.description,
    status: todo.status,
    dueDate: todo.dueDate,
  }));

  // Find similar notes for context
  const similarNotes = await workNoteService.findSimilarNotes(newContent, SIMILAR_NOTES_TOP_K);

  // Generate enhanced draft
  const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
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
});

/**
 * POST /ai/meeting-minutes/:meetingId/refine
 * Refine meeting minute content using a transcript
 */
app.post(
  '/meeting-minutes/:meetingId/refine',
  bodyValidator(RefineMeetingMinuteRequestSchema),
  async (c) => {
    const meetingId = c.req.param('meetingId')!;
    const body = getValidatedBody<typeof RefineMeetingMinuteRequestSchema>(c);

    const repository = new MeetingMinuteRepository(c.get('db'));
    const meetingMinute = await repository.findById(meetingId);

    if (!meetingMinute) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
    const result = await aiDraftService.refineMeetingMinute(
      meetingMinute.topic,
      meetingMinute.detailsRaw,
      body.transcript
    );

    return c.json({
      refinedContent: result.refinedContent,
      originalContent: meetingMinute.detailsRaw,
    });
  }
);

export default app;
