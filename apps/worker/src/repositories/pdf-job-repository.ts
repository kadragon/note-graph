// Trace: SPEC-pdf-1, TASK-014
// Repository for managing PDF processing jobs in database

import type {
  PdfJob,
  PdfJobStatus,
  PdfUploadMetadata,
  WorkNoteDraft,
  WorkNoteDraftWithReferences,
} from '@shared/types/pdf';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors.js';

interface PdfJobRow {
  job_id: string;
  status: PdfJobStatus;
  r2_key: string | null;
  extracted_text: string | null;
  draft_json: string | null;
  error_message: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * PdfJobRepository
 * Manages PDF job lifecycle in database
 */
export class PdfJobRepository {
  constructor(private db: DatabaseClient) {}

  private toPdfJob(result: PdfJobRow): PdfJob {
    return {
      jobId: result.job_id,
      status: result.status,
      r2Key: result.r2_key,
      extractedText: result.extracted_text,
      draftJson: result.draft_json,
      errorMessage: result.error_message,
      metadataJson: result.metadata_json,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  /**
   * Create a new PDF job
   */
  async create(jobId: string, r2Key: string, metadata: PdfUploadMetadata): Promise<PdfJob> {
    const now = new Date().toISOString();
    const metadataJson = JSON.stringify(metadata);

    await this.db.execute(
      `INSERT INTO pdf_jobs (job_id, status, r2_key, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jobId, 'PENDING', r2Key, metadataJson, now, now]
    );

    const job = await this.getById(jobId);
    if (!job) {
      throw new Error('Failed to create PDF job');
    }
    return job;
  }

  /**
   * Get PDF job by ID
   */
  async getById(jobId: string): Promise<PdfJob | null> {
    const result = await this.db.queryOne<PdfJobRow>('SELECT * FROM pdf_jobs WHERE job_id = ?', [
      jobId,
    ]);

    if (!result) {
      return null;
    }

    return this.toPdfJob(result);
  }

  /**
   * Update job status to PROCESSING
   */
  async updateStatusToProcessing(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.db.execute(
      'UPDATE pdf_jobs SET status = ?, updated_at = ? WHERE job_id = ?',
      ['PROCESSING', now, jobId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('PDF job', jobId);
    }
  }

  /**
   * Update job status to READY with draft
   */
  async updateStatusToReady(
    jobId: string,
    draft: WorkNoteDraft | WorkNoteDraftWithReferences
  ): Promise<void> {
    const now = new Date().toISOString();
    const draftJson = JSON.stringify(draft);

    const result = await this.db.execute(
      `UPDATE pdf_jobs
       SET status = ?, draft_json = ?, r2_key = NULL, updated_at = ?
       WHERE job_id = ?`,
      ['READY', draftJson, now, jobId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('PDF job', jobId);
    }
  }

  /**
   * Update job status to ERROR with error message
   */
  async updateStatusToError(jobId: string, errorMessage: string): Promise<void> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      `UPDATE pdf_jobs
       SET status = ?, error_message = ?, r2_key = NULL, updated_at = ?
       WHERE job_id = ?`,
      ['ERROR', errorMessage, now, jobId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('PDF job', jobId);
    }
  }

  /**
   * Delete PDF job
   */
  async delete(jobId: string): Promise<void> {
    const result = await this.db.execute('DELETE FROM pdf_jobs WHERE job_id = ?', [jobId]);

    if (result.rowCount === 0) {
      throw new NotFoundError('PDF job', jobId);
    }
  }

  /**
   * Delete old PDF jobs (older than N days)
   * Used for scheduled cleanup
   */
  async deleteOldJobs(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    const result = await this.db.execute('DELETE FROM pdf_jobs WHERE created_at < ?', [cutoffIso]);

    return result.rowCount;
  }
}
