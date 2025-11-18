// Trace: SPEC-pdf-1, TASK-014
// PDF upload and job status routes

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env.js';
import { PdfJobRepository } from '../repositories/pdf-job-repository.js';
import { BadRequestError, NotFoundError } from '../types/errors.js';
import { validateParams } from '../utils/validation.js';
import { getPdfJobParamsSchema } from '../schemas/pdf.js';
import type {
  PdfJobResponse,
  PdfQueueMessage,
  PdfUploadMetadata,
  WorkNoteDraft,
} from '../types/pdf.js';

// Configuration constants
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const pdf = new Hono<{ Bindings: Env }>();

/**
 * POST /pdf-jobs
 * Upload PDF file, create job, send to queue
 */
pdf.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  // Validate file (check for Blob since File extends Blob)
  if (!file || typeof file === 'string') {
    throw new BadRequestError('PDF file is required');
  }

  const fileBlob = file as Blob;

  // Check file type
  if (fileBlob.type !== 'application/pdf') {
    throw new BadRequestError('파일은 PDF 형식이어야 합니다');
  }

  // Check file size
  if (fileBlob.size > MAX_PDF_SIZE_BYTES) {
    return c.json(
      {
        error: 'PAYLOAD_TOO_LARGE',
        message: 'PDF 파일 크기는 10MB를 초과할 수 없습니다',
      },
      413
    );
  }

  // Extract metadata
  const metadata: PdfUploadMetadata = {};
  const category = formData.get('category');
  const personIds = formData.get('personIds');
  const deptName = formData.get('deptName');

  if (category && typeof category === 'string') {
    metadata.category = category;
  }
  if (personIds && typeof personIds === 'string') {
    metadata.personIds = personIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean); // Remove empty strings
  }
  if (deptName && typeof deptName === 'string') {
    metadata.deptName = deptName;
  }

  // Generate job ID and R2 key
  const jobId = `PDF-${nanoid()}`;
  const timestamp = Date.now();
  const fileName = (fileBlob as File).name || 'upload.pdf';
  const r2Key = `pdfs/${jobId}/${timestamp}-${fileName}`;

  // Upload PDF to R2
  const arrayBuffer = await fileBlob.arrayBuffer();
  await c.env.PDF_TEMP_STORAGE.put(r2Key, arrayBuffer, {
    customMetadata: {
      jobId,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Create job in database
  const repository = new PdfJobRepository(c.env.DB);
  const job = await repository.create(jobId, r2Key, metadata);

  // Send message to queue
  const queueMessage: PdfQueueMessage = {
    jobId,
    r2Key,
    metadata,
  };

  await c.env.PDF_QUEUE.send(queueMessage);

  // Return job response
  const response: PdfJobResponse = {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  return c.json(response, 202);
});

/**
 * GET /pdf-jobs/:jobId
 * Poll job status and get draft when ready
 */
pdf.get('/:jobId', async (c) => {
  const { jobId } = validateParams(c, getPdfJobParamsSchema);

  const repository = new PdfJobRepository(c.env.DB);
  const job = await repository.getById(jobId);

  if (!job) {
    throw new NotFoundError('PDF job', jobId);
  }

  // Build response
  const response: PdfJobResponse = {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  // Add error message if status is ERROR
  if (job.status === 'ERROR' && job.errorMessage) {
    response.errorMessage = job.errorMessage;
  }

  // Add draft if status is READY
  if (job.status === 'READY' && job.draftJson) {
    try {
      const draft: WorkNoteDraft = JSON.parse(job.draftJson);
      response.draft = draft;
    } catch (error) {
      console.error('Failed to parse draft JSON:', error);
      response.errorMessage = 'Failed to parse draft data';
    }
  }

  return c.json(response);
});

export default pdf;
