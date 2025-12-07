// Trace: SPEC-worknote-1, SPEC-rag-1, SPEC-worknote-attachments-1, TASK-007, TASK-010, TASK-012, TASK-057
/**
 * Work note management routes with integrated RAG support and file attachments
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { authMiddleware } from '../middleware/auth';
import { TodoRepository } from '../repositories/todo-repository';
import { createTodoSchema } from '../schemas/todo';
import {
  createWorkNoteSchema,
  listWorkNotesQuerySchema,
  updateWorkNoteSchema,
} from '../schemas/work-note';
import { WorkNoteFileService } from '../services/work-note-file-service';
import { WorkNoteService } from '../services/work-note-service';
import type { Env } from '../types/env';
import { DomainError } from '../types/errors';
import { validateBody, validateQuery } from '../utils/validation';

// Type for global test R2 bucket (used in tests)
interface GlobalWithTestBucket {
  __TEST_R2_BUCKET?: unknown;
}

const workNotes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);

/**
 * Trigger re-embedding of a work note (fire-and-forget)
 * Used when todo changes require vector store update
 */
function triggerReembed(env: Env, workId: string, todoId: string, operation: string): void {
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
workNotes.get('/', async (c) => {
  try {
    const query = validateQuery(c, listWorkNotesQuerySchema);
    const service = new WorkNoteService(c.env);
    const results = await service.findAll(query);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error listing work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes - Create new work note
 * Automatically chunks and embeds for RAG
 */
workNotes.post('/', async (c) => {
  try {
    const data = await validateBody(c, createWorkNoteSchema);
    const service = new WorkNoteService(c.env);
    const workNote = await service.create(data);

    return c.json(workNote, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error creating work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId - Get work note by ID
 */
workNotes.get('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const service = new WorkNoteService(c.env);
    const workNote = await service.findByIdWithDetails(workId);

    if (!workNote) {
      return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
    }

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /work-notes/:workId - Update work note
 * Automatically re-chunks and re-embeds for RAG
 */
workNotes.put('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, updateWorkNoteSchema);
    const service = new WorkNoteService(c.env);
    const workNote = await service.update(workId, data);

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error updating work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /work-notes/:workId - Delete work note
 * Automatically deletes all chunks from Vectorize
 */
workNotes.delete('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const service = new WorkNoteService(c.env);
    await service.delete(workId);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error deleting work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId/todos - Get todos for work note
 */
workNotes.get('/:workId/todos', async (c) => {
  try {
    const { workId } = c.req.param();
    const repository = new TodoRepository(c.env.DB);
    const todos = await repository.findByWorkId(workId);

    return c.json(todos);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting work note todos:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes/:workId/todos - Create todo for work note
 * Re-embeds the parent work note to include new todo in vector store
 */
workNotes.post('/:workId/todos', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, createTodoSchema);
    const repository = new TodoRepository(c.env.DB);
    const todo = await repository.create(workId, data);

    // Re-embed work note to include new todo in vector store (async, non-blocking)
    triggerReembed(c.env, workId, todo.todoId, 'creation');

    return c.json(todo, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error creating todo:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes/:workId/files - Upload file to work note
 */
workNotes.post('/:workId/files', async (c) => {
  try {
    const { workId } = c.req.param();
    const user = c.get('user');

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return c.json({ code: 'BAD_REQUEST', message: '파일이 제공되지 않았습니다' }, 400);
    }

    // Type assertion: file is now guaranteed to be File-like (Blob with name property)
    const fileData = file as Blob & { name: string; type: string };
    const fileBlob = new Blob([await fileData.arrayBuffer()], { type: fileData.type });
    const originalName = fileData.name;

    // Get R2 bucket
    const r2Bucket =
      c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
    if (!r2Bucket) {
      throw new Error('R2_BUCKET not configured');
    }

    // Upload file using service
    const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
    const uploadedFile = await fileService.uploadFile({
      workId,
      file: fileBlob,
      originalName,
      uploadedBy: user.email,
    });

    return c.json(uploadedFile, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error uploading file:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId/files - List work note files
 */
workNotes.get('/:workId/files', async (c) => {
  try {
    const { workId } = c.req.param();

    const r2Bucket =
      c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
    if (!r2Bucket) {
      throw new Error('R2_BUCKET not configured');
    }

    const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
    const files = await fileService.listFiles(workId);

    return c.json(files);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error listing files:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId/files/:fileId - Get file metadata
 */
workNotes.get('/:workId/files/:fileId', async (c) => {
  try {
    const { fileId } = c.req.param();

    const r2Bucket =
      c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
    if (!r2Bucket) {
      throw new Error('R2_BUCKET not configured');
    }

    const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
    const file = await fileService.getFileById(fileId);

    if (!file) {
      return c.json({ code: 'NOT_FOUND', message: `File not found: ${fileId}` }, 404);
    }

    return c.json(file);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting file:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId/files/:fileId/download - Download file (stream from R2)
 */
workNotes.get('/:workId/files/:fileId/download', async (c) => {
  try {
    const { fileId } = c.req.param();

    const r2Bucket =
      c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
    if (!r2Bucket) {
      throw new Error('R2_BUCKET not configured');
    }

    const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
    const { body, headers } = await fileService.streamFile(fileId);

    return new Response(body, { headers });
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error downloading file:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /work-notes/:workId/files/:fileId - Delete file
 */
workNotes.delete('/:workId/files/:fileId', async (c) => {
  try {
    const { fileId } = c.req.param();

    const r2Bucket =
      c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
    if (!r2Bucket) {
      throw new Error('R2_BUCKET not configured');
    }

    const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
    await fileService.deleteFile(fileId);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error deleting file:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default workNotes;
