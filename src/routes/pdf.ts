// Trace: SPEC-pdf-1, TASK-014
// PDF upload route with synchronous processing

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env } from '../types/env.js';
import { PdfJobRepository } from '../repositories/pdf-job-repository.js';
import { PdfExtractionService } from '../services/pdf-extraction-service.js';
import { AIDraftService } from '../services/ai-draft-service.js';
import { WorkNoteService } from '../services/work-note-service.js';
import { BadRequestError, NotFoundError } from '../types/errors.js';
import type {
  PdfJobResponse,
  PdfUploadMetadata,
  WorkNoteDraft,
  WorkNoteDraftWithReferences,
} from '../types/pdf.js';
import type { SimilarWorkNoteReference } from '../types/search.js';

// Configuration constants
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const SIMILAR_NOTES_TOP_K = 3;
const SIMILARITY_SCORE_THRESHOLD = 0.5;

const pdf = new Hono<{ Bindings: Env }>();

/**
 * GET /pdf-jobs/:jobId
 * Get PDF job status and result
 */
pdf.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const repository = new PdfJobRepository(c.env.DB);

  const job = await repository.getById(jobId);
  if (!job) {
    throw new NotFoundError('PDF job', jobId);
  }

  let draft: WorkNoteDraft | undefined;
  let references: SimilarWorkNoteReference[] | undefined;
  if (job.draftJson) {
    try {
      const parsed = JSON.parse(job.draftJson) as WorkNoteDraft | WorkNoteDraftWithReferences;
      if ('draft' in parsed && 'references' in parsed) {
        draft = parsed.draft;
        references = parsed.references;
      } else {
        draft = parsed;
      }
    } catch (error) {
      console.error(`[PDF Job ${jobId}] Failed to parse draft JSON:`, error);
      draft = undefined;
    }
  }

  const response: PdfJobResponse = {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    errorMessage: job.errorMessage || undefined,
    draft,
    references,
  };

  return c.json(response);
});

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

  // Create job with PENDING status before processing
  await repository.create(jobId, fileName, metadata);

  try {
    // Validate PDF
    extractionService.validatePdfBuffer(pdfBuffer);

    // Extract text
    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Extracting text from PDF: ${fileName}`);
    const extractedText = await extractionService.extractText(pdfBuffer);

    // Search for similar work notes using shared service
    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Searching for similar work notes for job ${jobId}`);
    const workNoteService = new WorkNoteService(c.env);
    const similarNotes = await workNoteService.findSimilarNotes(
      extractedText,
      SIMILAR_NOTES_TOP_K,
      SIMILARITY_SCORE_THRESHOLD
    );

    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Found ${similarNotes.length} similar work notes`);

    // Generate AI draft with similar notes as context
    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Generating AI draft for job ${jobId}`);
    const draft = similarNotes.length > 0
      ? await aiDraftService.generateDraftFromTextWithContext(extractedText, similarNotes, {
          category: metadata.category,
          personIds: metadata.personIds,
          deptName: metadata.deptName,
        })
      : await aiDraftService.generateDraftFromText(extractedText, {
          category: metadata.category,
          personIds: metadata.personIds,
          deptName: metadata.deptName,
        });

    const references: SimilarWorkNoteReference[] = similarNotes.map((note) => ({
      workId: note.workId,
      title: note.title,
      content: note.content,
      category: note.category,
      similarityScore: note.similarityScore,
    }));

    // Update job status to READY
    const draftPayload: WorkNoteDraftWithReferences = { draft, references };
    await repository.updateStatusToReady(jobId, draftPayload);

    // eslint-disable-next-line no-console
    console.log(`[PDF Processing] Job ${jobId} completed successfully`);

    // Fetch actual job record with accurate timestamps
    const job = await repository.getById(jobId);
    if (!job) {
      throw new NotFoundError('PDF job', jobId);
    }

    // Return successful response with draft from DB
    let responseDraft: WorkNoteDraft | undefined;
    let responseReferences: SimilarWorkNoteReference[] | undefined;
    if (job.draftJson) {
      try {
        const parsed = JSON.parse(job.draftJson) as WorkNoteDraft | WorkNoteDraftWithReferences;
        if ('draft' in parsed && 'references' in parsed) {
          responseDraft = parsed.draft;
          responseReferences = parsed.references;
        } else {
          responseDraft = parsed;
        }
      } catch (error) {
        console.error(`[PDF Job ${jobId}] Failed to parse draft JSON in response:`, error);
      }
    }

    const response: PdfJobResponse = {
      jobId: job.jobId,
      status: job.status,
      draft: responseDraft,
      references: responseReferences,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error(`[PDF Processing] Error processing job ${jobId}:`, error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'PDF 처리 중 알 수 없는 오류가 발생했습니다';

    // Update job status to ERROR
    try {
      await repository.updateStatusToError(jobId, errorMessage);
    } catch (dbError) {
      console.error(`[PDF Processing] Failed to update error state:`, dbError);
    }

    // Fetch job record for accurate error response
    const job = await repository.getById(jobId);

    // Return error response
    return c.json(
      {
        error: 'PDF_PROCESSING_ERROR',
        message: errorMessage,
        jobId,
        status: job?.status || 'ERROR',
        createdAt: job?.createdAt || new Date().toISOString(),
        updatedAt: job?.updatedAt || new Date().toISOString(),
      },
      500
    );
  }
});

export default pdf;
