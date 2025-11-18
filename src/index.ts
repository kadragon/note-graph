// Trace: SPEC-auth-1, TASK-001, TASK-003, TASK-004, TASK-015
/**
 * Note Graph - Main Worker Entry Point
 * Personal work note management system with AI-powered features
 */

import { Hono } from 'hono';
import type { AuthUser } from './types/auth';
import { AuthenticationError } from './types/auth';
import { DomainError } from './types/errors';
import type { Env } from './types/env';
import { authMiddleware } from './middleware/auth';
import { getMeHandler } from './handlers/auth';
import { PdfJobRepository } from './repositories/pdf-job-repository';
import { PdfExtractionService } from './services/pdf-extraction-service';
import { AIDraftService } from './services/ai-draft-service';
import type { PdfQueueMessage } from './types/pdf';

// Route imports
import persons from './routes/persons';
import departments from './routes/departments';
import workNotes from './routes/work-notes';
import todos from './routes/todos';
import search from './routes/search';
import rag from './routes/rag';
import aiDraft from './routes/ai-draft';
import pdf from './routes/pdf';

// Re-export Env type for compatibility
export type { Env };

// Initialize Hono app with auth context
const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'note-graph',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Note Graph API',
    version: '0.1.0',
    description: 'Personal work note management system with AI-powered features',
    endpoints: {
      health: '/health',
      me: '/me',
      docs: '/openapi.yaml',
    },
  });
});

// ============================================================================
// Authenticated Endpoints
// ============================================================================

// GET /me - Get current authenticated user
app.get('/me', authMiddleware, getMeHandler);

// ============================================================================
// API Route Groups
// ============================================================================

app.route('/persons', persons);
app.route('/departments', departments);
app.route('/work-notes', workNotes);
app.route('/todos', todos);
app.route('/search', search);
app.route('/rag', rag);
app.route('/ai', aiDraft);
app.route('/pdf-jobs', pdf);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error(`Application error: ${err instanceof Error ? err.stack || err : JSON.stringify(err)}`);

  // Handle authentication errors
  if (err instanceof AuthenticationError) {
    return c.json(
      {
        code: 'UNAUTHORIZED',
        message: err.message,
      },
      401
    );
  }

  // Handle domain errors (ValidationError, NotFoundError, etc.)
  if (err instanceof DomainError) {
    const response: { code: string; message: string; details?: unknown } = {
      code: err.code,
      message: err.message,
    };
    if (err.details) {
      response.details = err.details;
    }
    return c.json(response, err.statusCode as 400 | 404 | 409 | 429 | 500);
  }

  // Avoid leaking internal error details to the client in non-dev environments.
  const isDevelopment = c.env.ENVIRONMENT === 'development';
  const message = isDevelopment && err instanceof Error ? err.message : 'An internal server error occurred.';
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message,
    },
    500
  );
});

// ============================================================================
// Queue Consumer for PDF Processing
// ============================================================================

/**
 * PDF Queue Consumer
 * Processes PDF files asynchronously:
 * 1. Fetch PDF from R2
 * 2. Extract text using unpdf
 * 3. Generate AI draft
 * 4. Update job status to READY or ERROR
 * 5. Delete PDF from R2
 */
export async function queue(
  batch: MessageBatch<PdfQueueMessage>,
  env: Env
): Promise<void> {
  const repository = new PdfJobRepository(env.DB);
  const extractionService = new PdfExtractionService();
  const aiDraftService = new AIDraftService(env);

  for (const message of batch.messages) {
    const { jobId, r2Key, metadata } = message.body;

    console.log(`[PDF Queue] Processing job ${jobId}`);

    try {
      // Update status to PROCESSING
      await repository.updateStatusToProcessing(jobId);

      // Fetch PDF from R2
      console.log(`[PDF Queue] Fetching PDF from R2: ${r2Key}`);
      const r2Object = await env.PDF_TEMP_STORAGE.get(r2Key);
      if (!r2Object) {
        throw new Error(`PDF not found in R2: ${r2Key}`);
      }

      const pdfBuffer = await r2Object.arrayBuffer();

      // Validate PDF
      extractionService.validatePdfBuffer(pdfBuffer);

      // Extract text
      console.log(`[PDF Queue] Extracting text from PDF`);
      const extractedText = await extractionService.extractText(pdfBuffer);

      // Store extracted text temporarily
      await repository.updateExtractedText(jobId, extractedText);

      // Generate AI draft
      console.log(`[PDF Queue] Generating AI draft`);
      const draft = await aiDraftService.generateDraftFromText(extractedText, {
        category: metadata.category,
        personIds: metadata.personIds,
        deptName: metadata.deptName,
      });

      // Update status to READY with draft
      await repository.updateStatusToReady(jobId, draft);

      // Delete PDF from R2
      console.log(`[PDF Queue] Deleting PDF from R2: ${r2Key}`);
      await env.PDF_TEMP_STORAGE.delete(r2Key);

      console.log(`[PDF Queue] Job ${jobId} completed successfully`);

      // Acknowledge message
      message.ack();
    } catch (error) {
      console.error(`[PDF Queue] Error processing job ${jobId}:`, error);

      // Update job status to ERROR
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'PDF 처리 중 알 수 없는 오류가 발생했습니다';

      try {
        await repository.updateStatusToError(jobId, errorMessage);

        // Try to delete PDF from R2 on error
        if (r2Key) {
          try {
            await env.PDF_TEMP_STORAGE.delete(r2Key);
            console.log(`[PDF Queue] Cleaned up PDF from R2: ${r2Key}`);
          } catch (deleteError) {
            console.error(
              `[PDF Queue] Failed to delete PDF from R2: ${r2Key}`,
              deleteError
            );
          }
        }
      } catch (updateError) {
        console.error(
          `[PDF Queue] Failed to update job status to ERROR:`,
          updateError
        );
      }

      // Acknowledge message to prevent retry loop for unrecoverable errors
      message.ack();
    }
  }
}

export default app;
