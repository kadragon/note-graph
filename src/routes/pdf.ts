// Trace: SPEC-pdf-1, TASK-014
// PDF upload route with synchronous processing

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env.js';
import { PdfJobRepository } from '../repositories/pdf-job-repository.js';
import { PdfExtractionService } from '../services/pdf-extraction-service.js';
import { AIDraftService } from '../services/ai-draft-service.js';
import { BadRequestError } from '../types/errors.js';
import type {
  PdfJobResponse,
  PdfUploadMetadata,
  WorkNoteDraft,
} from '../types/pdf.js';

// Configuration constants
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const pdf = new Hono<{ Bindings: Env }>();

/**
 * POST /pdf-jobs
 * Upload PDF file and process synchronously
 * - Validates and extracts text from PDF
 * - Generates AI draft using OpenAI
 * - Returns draft immediately
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

  // Generate job ID
  const jobId = `PDF-${nanoid()}`;
  const fileName = (fileBlob as File).name || 'upload.pdf';

  // Get PDF buffer
  const pdfBuffer = await fileBlob.arrayBuffer();

  // Initialize services
  const extractionService = new PdfExtractionService();
  const aiDraftService = new AIDraftService(c.env);
  const repository = new PdfJobRepository(c.env.DB);

  let draft: WorkNoteDraft;

  try {
    // Validate PDF
    extractionService.validatePdfBuffer(pdfBuffer);

    // Extract text
    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Extracting text from PDF: ${fileName}`);
    const extractedText = await extractionService.extractText(pdfBuffer);

    // Generate AI draft
    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Generating AI draft for job ${jobId}`);
    draft = await aiDraftService.generateDraftFromText(extractedText, {
      category: metadata.category,
      personIds: metadata.personIds,
      deptName: metadata.deptName,
    });

    // Save job with READY status
    await repository.create(jobId, fileName, metadata);
    await repository.updateStatusToReady(jobId, draft);

    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[PDF Processing] Error processing job ${jobId}:`, error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'PDF 처리 중 알 수 없는 오류가 발생했습니다';

    // Save job with ERROR status
    try {
      await repository.create(jobId, fileName, metadata);
      await repository.updateStatusToError(jobId, errorMessage);
    } catch (dbError) {
      console.error(`[PDF Processing] Failed to save error state:`, dbError);
    }

    // Return error response
    return c.json(
      {
        error: 'PDF_PROCESSING_ERROR',
        message: errorMessage,
      },
      500
    );
  }

  // Return successful response with draft
  const response: PdfJobResponse = {
    jobId,
    status: 'READY',
    draft,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json(response, 200);
});

export default pdf;
