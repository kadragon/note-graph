// Trace: SPEC-ai-draft-1, SPEC-ai-draft-refs-1, SPEC-refactor-repository-di, TASK-013, TASK-029, TASK-REFACTOR-004
/**
 * AI-powered work note draft generation routes
 */

import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import {
  AgentDraftRequestSchema,
  DraftFromTextRequestSchema,
  EmailReplyRequestSchema,
  enhanceWorkNoteRequestSchema,
  TodoSuggestionsRequestSchema,
} from '../schemas/ai-draft';
import { AgentDraftService } from '../services/agent-draft-service';
import { AIDraftService } from '../services/ai-draft-service';
import { FileTextExtractionService } from '../services/file-text-extraction-service';
import { MeetingMinuteReferenceService } from '../services/meeting-minute-reference-service';
import { PdfExtractionService } from '../services/pdf-extraction-service';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext } from '../types/context';
import { BadRequestError, NotFoundError } from '../types/errors';
import { createAgentSSEResponse, createBufferedSSEResponse } from '../utils/buffered-sse';
import { createSSEProxy } from '../utils/openai-chat';
import { createProtectedRouter } from './_shared/router-factory';

// Configuration constants
const SIMILAR_NOTES_TOP_K = 3;
const MEETING_REFERENCES_TOP_K = 5;
const MEETING_REFERENCES_MIN_SCORE = 0.3;
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const PDF_MAX_TEXT_LENGTH = 30_000;

const app = createProtectedRouter<AppContext>();

/**
 * POST /ai/work-notes/draft-from-text
 * Generate work note draft from unstructured text
 */
app.post('/work-notes/draft-from-text', bodyValidator(DraftFromTextRequestSchema), async (c) => {
  const body = getValidatedBody<typeof DraftFromTextRequestSchema>(c);
  const { taskCategories, todos: todoRepository } = c.get('repositories');

  return createBufferedSSEResponse(async () => {
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

    return { draft, references: [] };
  });
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

    return createBufferedSSEResponse(async () => {
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

      return {
        draft,
        references,
        meetingReferences: scoredMeetingReferences,
      };
    });
  }
);

/**
 * POST /ai/work-notes/agent-draft
 * Generate work note draft using an agentic loop with tool calling.
 * The AI autonomously decides which tools to use (similar notes, meeting minutes)
 * and streams progress events to the client.
 */
app.post('/work-notes/agent-draft', bodyValidator(AgentDraftRequestSchema), async (c) => {
  const body = getValidatedBody<typeof AgentDraftRequestSchema>(c);
  const { taskCategories, todos: todoRepository } = c.get('repositories');

  return createAgentSSEResponse(async (sendProgress) => {
    const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));
    const meetingMinuteReferenceService = new MeetingMinuteReferenceService(c.get('db'));

    const [activeCategories, todoDueDateContext] = await Promise.all([
      taskCategories.findAll(undefined, 100, true),
      todoRepository.getOpenTodoDueDateContextForAI(10),
    ]);

    const agentService = new AgentDraftService(
      c.env,
      workNoteService,
      meetingMinuteReferenceService,
      c.get('settingService')
    );

    return agentService.generateDraft(
      body.inputText,
      {
        category: body.category,
        personIds: body.personIds,
        deptName: body.deptName,
        activeCategories: activeCategories.map((cat) => cat.name),
        todoDueDateContext,
      },
      sendProgress
    );
  });
});

/**
 * POST /ai/work-notes/agent-draft-from-pdf
 * Generate work note draft from uploaded PDF using an agentic loop with tool calling.
 * Accepts multipart form data with the PDF file and optional metadata.
 */
app.post('/work-notes/agent-draft-from-pdf', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    throw new BadRequestError('PDF file is required');
  }

  const fileBlob = file as Blob;

  if (fileBlob.type !== 'application/pdf') {
    throw new BadRequestError('파일은 PDF 형식이어야 합니다');
  }

  if (fileBlob.size > MAX_PDF_SIZE_BYTES) {
    return c.json(
      { error: 'PAYLOAD_TOO_LARGE', message: 'PDF 파일 크기는 10MB를 초과할 수 없습니다' },
      413
    );
  }

  // Extract metadata from form data
  const category = formData.get('category');
  const personIds = formData.get('personIds');
  const deptName = formData.get('deptName');

  const metadata = {
    category: category && typeof category === 'string' ? category : undefined,
    personIds:
      personIds && typeof personIds === 'string'
        ? personIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : undefined,
    deptName: deptName && typeof deptName === 'string' ? deptName : undefined,
  };

  // Extract text from PDF before entering SSE stream
  const pdfBuffer = await fileBlob.arrayBuffer();
  const extractionService = new PdfExtractionService();
  extractionService.validatePdfBuffer(pdfBuffer);
  let extractedText = await extractionService.extractText(pdfBuffer);

  const wasTruncated = extractedText.length > PDF_MAX_TEXT_LENGTH;
  if (wasTruncated) {
    extractedText = extractedText.slice(0, PDF_MAX_TEXT_LENGTH);
  }

  const { taskCategories, todos: todoRepository } = c.get('repositories');

  return createAgentSSEResponse(async (sendProgress) => {
    sendProgress({
      step: 'analyzing',
      message: 'PDF에서 텍스트를 추출했습니다. 분석을 시작합니다...',
    });

    if (wasTruncated) {
      sendProgress({
        step: 'analyzing',
        message: `PDF 텍스트가 30,000자를 초과하여 앞부분만 사용합니다.`,
      });
    }

    const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));
    const meetingMinuteReferenceService = new MeetingMinuteReferenceService(c.get('db'));

    const [activeCategories, todoDueDateContext] = await Promise.all([
      taskCategories.findAll(undefined, 100, true),
      todoRepository.getOpenTodoDueDateContextForAI(10),
    ]);

    const agentService = new AgentDraftService(
      c.env,
      workNoteService,
      meetingMinuteReferenceService,
      c.get('settingService')
    );

    return agentService.generateDraft(
      extractedText,
      {
        category: metadata.category,
        personIds: metadata.personIds,
        deptName: metadata.deptName,
        activeCategories: activeCategories.map((cat) => cat.name),
        todoDueDateContext,
      },
      sendProgress
    );
  });
});

/**
 * POST /ai/work-notes/:workId/todo-suggestions
 * Generate todo suggestions for existing work note
 */
app.post(
  '/work-notes/:workId/todo-suggestions',
  bodyValidator(TodoSuggestionsRequestSchema),
  async (c) => {
    const workId = c.req.param('workId') as string;
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

    return createBufferedSSEResponse(async () => {
      const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
      return aiDraftService.generateTodoSuggestions(workNote, body.contextText, {
        todoDueDateContext,
      });
    });
  }
);

/**
 * POST /ai/work-notes/:workId/enhance
 * Enhance existing work note with new content (text and/or file)
 */
app.post('/work-notes/:workId/enhance', async (c) => {
  const workId = c.req.param('workId') as string;
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

  const workNote = await workNoteService.findByIdWithDetails(workId);
  if (!workNote) {
    throw new NotFoundError('Work note', workId);
  }

  return createBufferedSSEResponse(async () => {
    const [existingTodos, activeCategories, todoDueDateContext, similarNotes] = await Promise.all([
      todoRepository.findByWorkId(workId),
      taskCategories.findAll(undefined, 100, true),
      todoRepository.getOpenTodoDueDateContextForAI(10),
      workNoteService.findSimilarNotes(newContent, SIMILAR_NOTES_TOP_K),
    ]);

    const activeCategoryNames = activeCategories.map((cat) => cat.name);
    const existingPersonIds = workNote.persons.map((p) => p.personId);
    const existingCategoryIds = workNote.categories.map((c) => c.categoryId);
    const todoReferences = existingTodos.map((todo) => ({
      title: todo.title,
      description: todo.description,
      status: todo.status,
      dueDate: todo.dueDate,
    }));

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

    return {
      enhancedDraft,
      existingCategoryIds,
      existingPersonIds,
      originalContent: workNote.contentRaw,
      existingTodos: existingTodos.map((todo) => ({
        todoId: todo.todoId,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        dueDate: todo.dueDate,
      })),
      references,
    };
  });
});

/**
 * POST /ai/work-notes/:workId/email-reply
 * Generate AI email reply for a work note assignee
 */
app.post('/work-notes/:workId/email-reply', bodyValidator(EmailReplyRequestSchema), async (c) => {
  const workId = c.req.param('workId') as string;
  const body = getValidatedBody<typeof EmailReplyRequestSchema>(c);
  const { todos: todoRepository } = c.get('repositories');

  const workNoteService = new WorkNoteService(c.get('db'), c.env, c.get('settingService'));

  const [workNote, todos] = await Promise.all([
    workNoteService.findById(workId),
    todoRepository.findByWorkId(workId),
  ]);

  if (!workNote) {
    throw new NotFoundError('Work note', workId);
  }

  const todoReferences = todos.map((todo) => ({
    title: todo.title,
    description: todo.description,
    status: todo.status,
    dueDate: todo.dueDate,
  }));

  const aiDraftService = new AIDraftService(c.env, c.get('settingService'));
  const upstreamResponse = await aiDraftService.generateEmailReplyStream(workNote, todoReferences, {
    name: body.assigneeName,
    position: body.assigneePosition,
    dept: body.assigneeDept,
  });

  return createSSEProxy(upstreamResponse, aiDraftService.getLightweightModel());
});

export default app;
