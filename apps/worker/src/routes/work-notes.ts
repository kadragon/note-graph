// Trace: SPEC-worknote-1, SPEC-rag-1, SPEC-worknote-attachments-1, SPEC-refactor-repository-di, TASK-007, TASK-010, TASK-012, TASK-057, TASK-066, TASK-REFACTOR-004
/**
 * Work note management routes with integrated RAG support and file attachments
 */

import type { WorkNoteFile } from '@shared/types/work-note';
import { Hono } from 'hono';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { type FileContext, workNoteFileMiddleware } from '../middleware/work-note-file';
import { createTodoSchema } from '../schemas/todo';
import {
  createWorkNoteSchema,
  listWorkNotesQuerySchema,
  updateWorkNoteSchema,
} from '../schemas/work-note';
import { WorkNoteFileService } from '../services/work-note-file-service';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext, AppVariables } from '../types/context';
import { getR2Bucket } from '../utils/r2-access';

type WorkNotesContext = {
  Bindings: AppContext['Bindings'];
  Variables: AppVariables & FileContext;
};

const workNotes = new Hono<WorkNotesContext>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);
workNotes.use('*', errorHandler);

/**
 * Trigger re-embedding of a work note (fire-and-forget)
 * Used when todo changes require vector store update
 */
function triggerReembed(
  env: AppContext['Bindings'],
  workId: string,
  todoId: string,
  operation: string
): void {
  const service = new WorkNoteService(env);
  service.reembedOnly(workId).catch((error) => {
    console.error(`[WorkNote] Failed to re-embed after todo ${operation}:`, {
      workId,
      todoId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * GET /work-notes - List work notes with filters
 */
workNotes.get('/', queryValidator(listWorkNotesQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listWorkNotesQuerySchema>(c);
  const service = new WorkNoteService(c.env);
  const results = await service.findAll(query);

  return c.json(results);
});

/**
 * POST /work-notes - Create new work note
 * Automatically chunks and embeds for RAG (in background)
 */
workNotes.post('/', bodyValidator(createWorkNoteSchema), async (c) => {
  const data = getValidatedBody<typeof createWorkNoteSchema>(c);
  const service = new WorkNoteService(c.env);
  const { workNote, embeddingPromise } = await service.create(data, { skipEmbedding: true });

  // Process embedding in background (non-blocking)
  if (embeddingPromise) {
    c.executionCtx.waitUntil(embeddingPromise);
  }

  return c.json(workNote, 201);
});

/**
 * GET /work-notes/:workId - Get work note by ID
 */
workNotes.get('/:workId', async (c) => {
  const { workId } = c.req.param();
  const service = new WorkNoteService(c.env);
  const workNote = await service.findByIdWithDetails(workId);

  if (!workNote) {
    return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
  }

  return c.json(workNote);
});

/**
 * PUT /work-notes/:workId - Update work note
 * Automatically re-chunks and re-embeds for RAG (in background)
 */
workNotes.put('/:workId', bodyValidator(updateWorkNoteSchema), async (c) => {
  const workId = c.req.param('workId');
  const data = getValidatedBody<typeof updateWorkNoteSchema>(c);
  const service = new WorkNoteService(c.env);
  const { workNote, embeddingPromise } = await service.update(workId, data, {
    skipEmbedding: true,
  });

  // Process re-embedding in background (non-blocking)
  if (embeddingPromise) {
    c.executionCtx.waitUntil(embeddingPromise);
  }

  return c.json(workNote);
});

/**
 * DELETE /work-notes/:workId - Delete work note
 * Automatically deletes all chunks from Vectorize
 */
workNotes.delete('/:workId', async (c) => {
  const workId = c.req.param('workId');
  const user = getAuthUser(c);
  const service = new WorkNoteService(c.env);
  await service.delete(workId, user.email);

  return c.body(null, 204);
});

/**
 * GET /work-notes/:workId/todos - Get todos for work note
 */
workNotes.get('/:workId/todos', async (c) => {
  const workId = c.req.param('workId');
  const { todos: repository } = c.get('repositories');
  const todos = await repository.findByWorkId(workId);

  return c.json(todos);
});

/**
 * POST /work-notes/:workId/todos - Create todo for work note
 * Re-embeds the parent work note to include new todo in vector store
 */
workNotes.post('/:workId/todos', bodyValidator(createTodoSchema), async (c) => {
  const workId = c.req.param('workId');
  const data = getValidatedBody<typeof createTodoSchema>(c);
  const { todos: repository } = c.get('repositories');
  const todo = await repository.create(workId, data);

  // Re-embed work note to include new todo in vector store (async, non-blocking)
  triggerReembed(c.env, workId, todo.todoId, 'creation');

  return c.json(todo, 201);
});

/**
 * POST /work-notes/:workId/files - Upload file to work note
 */
workNotes.post('/:workId/files', async (c) => {
  const workId = c.req.param('workId');
  const user = getAuthUser(c);

  // Verify work note exists before accepting upload
  const workNoteService = new WorkNoteService(c.env);
  const workNote = await workNoteService.findById(workId);
  if (!workNote) {
    return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
  }

  // Parse multipart form data
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return c.json({ code: 'BAD_REQUEST', message: '파일이 제공되지 않았습니다' }, 400);
  }

  // File from formData is already a File instance (subclass of Blob)
  const fileData = file as File;

  // Get R2 bucket
  const r2Bucket = getR2Bucket(c.env);

  // Upload file using service (now uses Google Drive)
  const fileService = new WorkNoteFileService(r2Bucket, c.env.DB, c.env);
  const uploadedFile = await fileService.uploadFile({
    workId,
    file: fileData,
    originalName: fileData.name,
    uploadedBy: user.email,
  });

  return c.json(uploadedFile, 201);
});

/**
 * GET /work-notes/:workId/files - List work note files
 */
workNotes.get('/:workId/files', workNoteFileMiddleware, async (c) => {
  const { workId } = c.req.param();
  if (!workId) {
    return c.json({ error: 'workId is required' }, 400);
  }
  const fileService = c.get('fileService');
  const files = await fileService.listFiles(workId);

  const driveConfigured = c.get('driveConfigured');
  c.header('X-Google-Drive-Configured', driveConfigured ? 'true' : 'false');

  return c.json(files);
});

/**
 * POST /work-notes/:workId/files/migrate - Migrate legacy R2 files to Google Drive
 */
workNotes.post('/:workId/files/migrate', workNoteFileMiddleware, async (c) => {
  const { workId } = c.req.param();
  const user = getAuthUser(c);
  if (!workId) {
    return c.json({ error: 'workId is required' }, 400);
  }

  const workNoteService = new WorkNoteService(c.env);
  const workNote = await workNoteService.findById(workId);
  if (!workNote) {
    return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
  }

  const fileService = c.get('fileService');
  const result = await fileService.migrateR2FilesToDrive(workId, user.email);

  return c.json(result);
});

/**
 * GET /work-notes/:workId/files/:fileId - Get file metadata
 */
workNotes.get('/:workId/files/:fileId', workNoteFileMiddleware, async (c) => {
  const file = c.get('file') as WorkNoteFile;
  return c.json(file);
});

/**
 * GET /work-notes/:workId/files/:fileId/download - Download file
 * For Google Drive files, redirects to the Drive view link
 */
workNotes.get('/:workId/files/:fileId/download', workNoteFileMiddleware, async (c) => {
  const file = c.get('file') as WorkNoteFile;

  // For Google Drive files, redirect to the Drive link
  if (file.storageType === 'GDRIVE' && file.gdriveWebViewLink) {
    return c.redirect(file.gdriveWebViewLink);
  }

  // For legacy R2 files, stream from R2
  const fileService = c.get('fileService');
  const { body, headers } = await fileService.streamFile(file.fileId);

  return new Response(body, { headers });
});

/**
 * GET /work-notes/:workId/files/:fileId/view - View file inline (for browser preview)
 * For Google Drive files, redirects to the Drive view link
 */
workNotes.get('/:workId/files/:fileId/view', workNoteFileMiddleware, async (c) => {
  const file = c.get('file') as WorkNoteFile;

  // For Google Drive files, redirect to the Drive link
  if (file.storageType === 'GDRIVE' && file.gdriveWebViewLink) {
    return c.redirect(file.gdriveWebViewLink);
  }

  // For legacy R2 files, stream with inline disposition for browser viewing
  const fileService = c.get('fileService');
  const { body, headers } = await fileService.streamFile(file.fileId, true);

  return new Response(body, { headers });
});

/**
 * DELETE /work-notes/:workId/files/:fileId - Delete file
 */
workNotes.delete('/:workId/files/:fileId', workNoteFileMiddleware, async (c) => {
  const { fileId } = c.req.param();
  if (!fileId) {
    return c.json({ error: 'fileId is required' }, 400);
  }
  const user = getAuthUser(c);
  const fileService = c.get('fileService');

  await fileService.deleteFile(fileId, user.email);

  return c.body(null, 204);
});

export default workNotes;
