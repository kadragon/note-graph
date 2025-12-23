// Trace: SPEC-worknote-attachments-1, TASK-066
/**
 * Work note file middleware
 *
 * Provides common setup and validation for file-related routes:
 * - Sets up R2 bucket and WorkNoteFileService
 * - Validates file existence and ownership
 */

import type { WorkNoteFile } from '@shared/types/work-note';
import type { Context, Next } from 'hono';
import { WorkNoteFileService } from '../services/work-note-file-service';
import type { Env } from '../types/env';
import { getR2Bucket } from '../utils/r2-access';

/**
 * Extended context with file service and file
 */
export interface FileContext {
  fileService: WorkNoteFileService;
  file?: WorkNoteFile;
}

/**
 * Middleware to set up file service and optionally validate file
 *
 * Always sets up R2 bucket and WorkNoteFileService in context.
 * If fileId param is present, validates file and adds it to context.
 *
 * @throws Error if R2_BUCKET is not configured
 * @returns 404 if fileId is present but file not found or doesn't belong to workId
 */
export async function workNoteFileMiddleware(
  c: Context<{ Bindings: Env; Variables: FileContext }>,
  next: Next
): Promise<Response | void> {
  // Get R2 bucket
  const r2Bucket = getR2Bucket(c.env);

  // Create file service and add to context
  const fileService = new WorkNoteFileService(r2Bucket, c.env.DB);
  c.set('fileService', fileService);

  // If fileId param exists, validate file
  const { workId, fileId } = c.req.param();
  if (fileId) {
    const file = await fileService.getFileById(fileId);
    if (!file || file.workId !== workId) {
      return c.json({ code: 'NOT_FOUND', message: `File not found: ${fileId}` }, 404);
    }
    c.set('file', file);
  }

  await next();
}
