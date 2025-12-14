// Trace: SPEC-project-1, TASK-037, TASK-065
/**
 * API routes for Project management
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { ProjectRepository } from '../repositories/project-repository';
import {
  addParticipantSchema,
  assignWorkNoteSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '../schemas/project';
import { ProjectFileService } from '../services/project-file-service';
import type { Env } from '../types/env';
import { BadRequestError, ConflictError, NotFoundError } from '../types/errors';
import { validateBody, validateQuery } from '../utils/validation';

// Interface for test environment global fallback
interface GlobalWithTestBucket {
  __TEST_R2_BUCKET?: R2Bucket;
}

const projects = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All project routes require authentication
projects.use('*', authMiddleware);

/**
 * POST /projects
 * Create a new project
 */
projects.post('/', async (c) => {
  const data = await validateBody(c, createProjectSchema);
  const repository = new ProjectRepository(c.env.DB);

  const project = await repository.create(data);

  return c.json(project, 201);
});

/**
 * GET /projects
 * List projects with optional filters
 */
projects.get('/', async (c) => {
  const query = validateQuery(c, listProjectsQuerySchema);
  const repository = new ProjectRepository(c.env.DB);

  const projects = await repository.findAll(query);

  return c.json(projects, 200);
});

/**
 * GET /projects/:projectId
 * Get project detail with associations
 */
projects.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  const project = await repository.getDetail(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  return c.json(project, 200);
});

/**
 * PUT /projects/:projectId
 * Update project
 */
projects.put('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const data = await validateBody(c, updateProjectSchema);
  const repository = new ProjectRepository(c.env.DB);

  const updated = await repository.update(projectId, data);

  return c.json(updated, 200);
});

/**
 * DELETE /projects/:projectId
 * Soft delete project
 */
projects.delete('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  // Get R2 bucket (in tests, env might not have R2_BUCKET at request time, so use test global fallback)
  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);

  const archiveResult = await fileService.archiveProjectFiles(projectId);

  // Log archival failures if any occurred
  if (archiveResult.failed.length > 0) {
    console.warn(
      `Failed to archive ${archiveResult.failed.length} files for project ${projectId}:`,
      archiveResult.failed
    );
  }

  await repository.delete(projectId);

  return c.body(null, 204);
});

/**
 * GET /projects/:projectId/stats
 * Get project statistics
 */
projects.get('/:projectId/stats', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  // Verify project exists
  const project = await repository.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const stats = await repository.getStatistics(projectId);

  return c.json(stats, 200);
});

/**
 * POST /projects/:projectId/participants
 * Add participant to project
 */
projects.post('/:projectId/participants', async (c) => {
  const projectId = c.req.param('projectId');
  const data = await validateBody(c, addParticipantSchema);
  const repository = new ProjectRepository(c.env.DB);

  // Verify project exists
  const project = await repository.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  await repository.addParticipant(projectId, data.personId, data.role);

  return c.body(null, 201);
});

/**
 * DELETE /projects/:projectId/participants/:personId
 * Remove participant from project
 */
projects.delete('/:projectId/participants/:personId', async (c) => {
  const projectId = c.req.param('projectId');
  const personId = c.req.param('personId');
  const repository = new ProjectRepository(c.env.DB);

  await repository.removeParticipant(projectId, personId);

  return c.body(null, 204);
});

/**
 * GET /projects/:projectId/todos
 * List todos for all work notes in the project
 */
projects.get('/:projectId/todos', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  // Verify project exists
  const project = await repository.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const todos = await repository.getTodos(projectId);

  return c.json(todos, 200);
});

/**
 * GET /projects/:projectId/work-notes
 * List project work notes
 */
projects.get('/:projectId/work-notes', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  const workNotes = await repository.getWorkNotes(projectId);

  return c.json(workNotes, 200);
});

/**
 * POST /projects/:projectId/work-notes
 * Assign work note to project
 */
projects.post('/:projectId/work-notes', async (c) => {
  const projectId = c.req.param('projectId');
  const data = await validateBody(c, assignWorkNoteSchema);
  const repository = new ProjectRepository(c.env.DB);

  // Verify project exists
  const project = await repository.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Check if work note already assigned to another project
  const existing = await c.env.DB.prepare(
    `
      SELECT
        pwn.project_id as project_id,
        p.project_id as joined_project_id,
        p.deleted_at as project_deleted_at
      FROM project_work_notes pwn
      LEFT JOIN projects p ON p.project_id = pwn.project_id
      WHERE pwn.work_id = ?
    `
  )
    .bind(data.workId)
    .first<{
      project_id: string;
      joined_project_id: string | null;
      project_deleted_at: string | null;
    }>();

  if (existing) {
    const isStale = !existing.joined_project_id || Boolean(existing.project_deleted_at);

    // Stale links can exist when the project was soft-deleted (deleted_at set),
    // because FK cascades don't run for soft deletes. Clean them up and continue.
    if (isStale) {
      await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM project_work_notes WHERE work_id = ?`).bind(data.workId),
        c.env.DB.prepare(`UPDATE work_notes SET project_id = NULL WHERE work_id = ?`).bind(
          data.workId
        ),
      ]);
    } else {
      // Idempotent: already assigned to this project
      if (existing.project_id === projectId) {
        return c.body(null, 201);
      }

      throw new ConflictError(
        `업무노트는 이미 다른 프로젝트(${existing.project_id})에 할당되어 있습니다`
      );
    }
  }

  // Insert association
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `
    INSERT INTO project_work_notes (project_id, work_id, assigned_at)
    VALUES (?, ?, ?)
  `
  )
    .bind(projectId, data.workId, now)
    .run();

  // Also update work_notes.project_id for convenience
  await c.env.DB.prepare(
    `
    UPDATE work_notes SET project_id = ? WHERE work_id = ?
  `
  )
    .bind(projectId, data.workId)
    .run();

  return c.body(null, 201);
});

/**
 * DELETE /projects/:projectId/work-notes/:workId
 * Remove work note from project
 */
projects.delete('/:projectId/work-notes/:workId', async (c) => {
  const projectId = c.req.param('projectId');
  const workId = c.req.param('workId');

  // Remove association
  await c.env.DB.prepare(
    `
    DELETE FROM project_work_notes
    WHERE project_id = ? AND work_id = ?
  `
  )
    .bind(projectId, workId)
    .run();

  // Clear work_notes.project_id
  await c.env.DB.prepare(
    `
    UPDATE work_notes SET project_id = NULL WHERE work_id = ?
  `
  )
    .bind(workId)
    .run();

  return c.body(null, 204);
});

/**
 * POST /projects/:projectId/files
 * Upload file to project
 */
projects.post('/:projectId/files', async (c) => {
  const projectId = c.req.param('projectId');
  const repository = new ProjectRepository(c.env.DB);

  // Verify project exists
  const project = await repository.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Parse multipart form data
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    throw new BadRequestError('파일이 필요합니다');
  }

  const fileBlob = file as Blob;

  // Get file name (if File object, otherwise use default)
  const originalName = (file as File).name || 'uploaded-file';

  // Get authenticated user email
  const user = c.get('user');

  // Get R2 bucket (in tests, env might not have R2_BUCKET at request time, so use test global fallback)
  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  // Upload file using service
  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);
  const uploadedFile = await fileService.uploadFile({
    projectId,
    file: fileBlob,
    originalName,
    uploadedBy: user.email,
  });

  return c.json(uploadedFile, 201);
});

/**
 * GET /projects/:projectId/files
 * List project files
 */
projects.get('/:projectId/files', async (c) => {
  const projectId = c.req.param('projectId');

  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);

  const files = await fileService.listFiles(projectId);

  return c.json(files, 200);
});

/**
 * GET /projects/:projectId/files/:fileId
 * Get file metadata
 */
projects.get('/:projectId/files/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);

  const file = await fileService.getFileById(fileId);
  if (!file) {
    throw new NotFoundError('File', fileId);
  }

  return c.json(file, 200);
});

/**
 * GET /projects/:projectId/files/:fileId/download
 * Download file (stream from R2)
 */
projects.get('/:projectId/files/:fileId/download', async (c) => {
  const fileId = c.req.param('fileId');

  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);

  const { body, headers } = await fileService.streamFile(fileId);

  return new Response(body, { headers });
});

/**
 * DELETE /projects/:projectId/files/:fileId
 * Delete file
 */
projects.delete('/:projectId/files/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  const r2Bucket =
    c.env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;
  if (!r2Bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  const fileService = new ProjectFileService(c.env, r2Bucket, c.env.DB);

  await fileService.deleteFile(fileId);

  return c.body(null, 204);
});

export { projects };
