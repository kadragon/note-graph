// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-004
// Unit tests for PdfJobRepository (Jest version)

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PdfUploadMetadata,
  WorkNoteDraft,
  WorkNoteDraftWithReferences,
} from '@shared/types/pdf';
import { PdfJobRepository } from '@worker/repositories/pdf-job-repository';
import { NotFoundError } from '@worker/types/errors';

let db: D1Database;

describe('PdfJobRepository', () => {
  let repository: PdfJobRepository;

  beforeEach(async () => {
    db = await globalThis.getDB();
    repository = new PdfJobRepository(db);

    // Clean up test data
    await db.prepare('DELETE FROM pdf_jobs').run();
  }, 30000); // Increase timeout to 30 seconds for database cleanup

  describe('create()', () => {
    it('should create a new PDF job with PENDING status', async () => {
      // Arrange
      const jobId = 'test-job-001';
      const r2Key = 'uploads/test.pdf';
      const metadata: PdfUploadMetadata = {
        category: '업무',
      };

      // Act
      const job = await repository.create(jobId, r2Key, metadata);

      // Assert
      expect(job).not.toBeNull();
      expect(job.jobId).toBe(jobId);
      expect(job.status).toBe('PENDING');
      expect(job.r2Key).toBe(r2Key);
      expect(job.metadataJson).toBe(JSON.stringify(metadata));
      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
    });

    it('should store metadata as JSON string', async () => {
      // Arrange
      const jobId = 'test-job-002';
      const r2Key = 'uploads/test2.pdf';
      const metadata = {
        fileName: 'test2.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;

      // Act
      const job = await repository.create(jobId, r2Key, metadata);

      // Assert
      const parsedMetadata = JSON.parse(job.metadataJson || '{}');
      expect(parsedMetadata.fileName).toBe('test2.pdf');
      expect(parsedMetadata.fileSize).toBe(2048);
      expect(parsedMetadata.mimeType).toBe('application/pdf');
    });

    it('should throw error if job creation fails', async () => {
      // Arrange - Use the same jobId twice to trigger unique constraint violation
      const jobId = 'test-job-duplicate';
      const r2Key = 'uploads/test.pdf';
      const metadata: PdfUploadMetadata = {
        category: '업무',
      };

      // Act & Assert
      await repository.create(jobId, r2Key, metadata);
      await expect(repository.create(jobId, r2Key, metadata)).rejects.toThrow();
    });
  });

  describe('getById()', () => {
    it('should retrieve PDF job by ID', async () => {
      // Arrange
      const jobId = 'test-job-003';
      const r2Key = 'uploads/test3.pdf';
      const metadata = {
        fileName: 'test3.pdf',
        fileSize: 3072,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      // Act
      const job = await repository.getById(jobId);

      // Assert
      expect(job).not.toBeNull();
      expect(job?.jobId).toBe(jobId);
      expect(job?.r2Key).toBe(r2Key);
    });

    it('should return null for non-existent job', async () => {
      // Act
      const job = await repository.getById('non-existent-job');

      // Assert
      expect(job).toBeNull();
    });

    it('should return all job fields', async () => {
      // Arrange
      const jobId = 'test-job-004';
      const r2Key = 'uploads/test4.pdf';
      const metadata = {
        fileName: 'test4.pdf',
        fileSize: 4096,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      // Act
      const job = await repository.getById(jobId);

      // Assert
      expect(job).toMatchObject({
        jobId,
        status: 'PENDING',
        r2Key,
        extractedText: null,
        draftJson: null,
        errorMessage: null,
      });
      expect(job?.metadataJson).toBeDefined();
      expect(job?.createdAt).toBeDefined();
      expect(job?.updatedAt).toBeDefined();
    });
  });

  describe('updateStatusToProcessing()', () => {
    it('should update job status to PROCESSING', async () => {
      // Arrange
      const jobId = 'test-job-005';
      const r2Key = 'uploads/test5.pdf';
      const metadata = {
        fileName: 'test5.pdf',
        fileSize: 5120,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      // Act
      await repository.updateStatusToProcessing(jobId);

      // Assert
      const job = await repository.getById(jobId);
      expect(job?.status).toBe('PROCESSING');
    });

    it('should throw NotFoundError for non-existent job', async () => {
      // Act & Assert
      await expect(repository.updateStatusToProcessing('non-existent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should update the updatedAt timestamp', async () => {
      // Arrange
      const jobId = 'test-job-006';
      const r2Key = 'uploads/test6.pdf';
      const metadata = {
        fileName: 'test6.pdf',
        fileSize: 6144,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      const job1 = await repository.create(jobId, r2Key, metadata);

      // Ensure timestamp changes without fake timers (Miniflare/D1 uses real timers)
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      await repository.updateStatusToProcessing(jobId);

      // Assert
      const job2 = await repository.getById(jobId);
      expect(job2?.updatedAt).not.toBe(job1.updatedAt);
    });
  });

  describe('updateStatusToReady()', () => {
    it('should update job status to READY with draft', async () => {
      // Arrange
      const jobId = 'test-job-007';
      const r2Key = 'uploads/test7.pdf';
      const metadata = {
        fileName: 'test7.pdf',
        fileSize: 7168,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      const draft: WorkNoteDraft = {
        title: 'Test Draft',
        content: 'Test content from PDF',
        category: 'PDF',
        todos: [
          {
            title: 'Review document',
            description: 'Review the extracted content',
          },
        ],
      };

      // Act
      await repository.updateStatusToReady(jobId, draft);

      // Assert
      const job = await repository.getById(jobId);
      expect(job?.status).toBe('READY');
      expect(job?.draftJson).toBe(JSON.stringify(draft));
      expect(job?.r2Key).toBeNull(); // r2Key should be cleared
    });

    it('should clear r2Key when status is READY', async () => {
      // Arrange
      const jobId = 'test-job-008';
      const r2Key = 'uploads/test8.pdf';
      const metadata = {
        fileName: 'test8.pdf',
        fileSize: 8192,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      const draft: WorkNoteDraft = {
        title: 'Test Draft 2',
        content: 'Test content',
        category: 'PDF',
        todos: [],
      };

      // Act
      await repository.updateStatusToReady(jobId, draft);

      // Assert
      const job = await repository.getById(jobId);
      expect(job?.r2Key).toBeNull();
    });

    it('should throw NotFoundError for non-existent job', async () => {
      // Arrange
      const draft: WorkNoteDraft = {
        title: 'Test',
        content: 'Test',
        category: 'PDF',
        todos: [],
      };

      // Act & Assert
      await expect(repository.updateStatusToReady('non-existent', draft)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should persist references when provided', async () => {
      const jobId = 'test-job-011';
      await repository.create(jobId, 'uploads/ref.pdf', {
        fileName: 'ref.pdf',
      } as unknown as PdfUploadMetadata);

      const draftWithRefs: WorkNoteDraftWithReferences = {
        draft: {
          title: 'Ref Draft',
          content: 'With references',
          category: 'PDF',
          todos: [],
        },
        references: [
          {
            workId: 'WORK-REF1',
            title: '참고1',
            content: '',
            category: '기획',
            similarityScore: 0.82,
          },
        ],
      };

      await repository.updateStatusToReady(jobId, draftWithRefs);

      const job = await repository.getById(jobId);
      expect(job?.status).toBe('READY');
      expect(job?.draftJson).toBe(JSON.stringify(draftWithRefs));
    });
  });

  describe('updateStatusToError()', () => {
    it('should update job status to ERROR with error message', async () => {
      // Arrange
      const jobId = 'test-job-009';
      const r2Key = 'uploads/test9.pdf';
      const metadata = {
        fileName: 'test9.pdf',
        fileSize: 9216,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      const errorMessage = 'PDF extraction failed: corrupt file';

      // Act
      await repository.updateStatusToError(jobId, errorMessage);

      // Assert
      const job = await repository.getById(jobId);
      expect(job?.status).toBe('ERROR');
      expect(job?.errorMessage).toBe(errorMessage);
      expect(job?.r2Key).toBeNull(); // r2Key should be cleared
    });

    it('should throw NotFoundError for non-existent job', async () => {
      // Act & Assert
      await expect(repository.updateStatusToError('non-existent', 'error')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('delete()', () => {
    it('should delete PDF job', async () => {
      // Arrange
      const jobId = 'test-job-010';
      const r2Key = 'uploads/test10.pdf';
      const metadata = {
        fileName: 'test10.pdf',
        fileSize: 10240,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      // Act
      await repository.delete(jobId);

      // Assert
      const job = await repository.getById(jobId);
      expect(job).toBeNull();
    });

    it('should throw NotFoundError when deleting non-existent job', async () => {
      // Act & Assert
      await expect(repository.delete('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteOldJobs()', () => {
    it('should delete jobs older than specified days', async () => {
      // Arrange - Create jobs with different dates
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago
      const oldDateIso = oldDate.toISOString();

      const recentDate = new Date(now);
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago
      const recentDateIso = recentDate.toISOString();

      // Insert old job directly with custom date
      await db
        .prepare(
          'INSERT INTO pdf_jobs (job_id, status, r2_key, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind('old-job', 'PENDING', 'uploads/old.pdf', '{}', oldDateIso, oldDateIso)
        .run();

      // Insert recent job
      await db
        .prepare(
          'INSERT INTO pdf_jobs (job_id, status, r2_key, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind('recent-job', 'PENDING', 'uploads/recent.pdf', '{}', recentDateIso, recentDateIso)
        .run();

      // Act - Delete jobs older than 7 days
      const deletedCount = await repository.deleteOldJobs(7);

      // Assert
      expect(deletedCount).toBe(1);

      const oldJob = await repository.getById('old-job');
      const recentJob = await repository.getById('recent-job');

      expect(oldJob).toBeNull();
      expect(recentJob).not.toBeNull();
    });

    it('should return 0 when no old jobs exist', async () => {
      // Arrange - Create only recent job
      const jobId = 'test-job-012';
      const r2Key = 'uploads/test12.pdf';
      const metadata = {
        fileName: 'test12.pdf',
        fileSize: 11264,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;
      await repository.create(jobId, r2Key, metadata);

      // Act
      const deletedCount = await repository.deleteOldJobs(7);

      // Assert
      expect(deletedCount).toBe(0);

      const job = await repository.getById(jobId);
      expect(job).not.toBeNull();
    });

    it('should use default of 7 days when not specified', async () => {
      // Arrange - Create old job (8 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      const oldDateIso = oldDate.toISOString();

      await db
        .prepare(
          'INSERT INTO pdf_jobs (job_id, status, r2_key, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind('old-job-2', 'PENDING', 'uploads/old2.pdf', '{}', oldDateIso, oldDateIso)
        .run();

      // Act - Use default (7 days)
      const deletedCount = await repository.deleteOldJobs();

      // Assert
      expect(deletedCount).toBe(1);
    });
  });

  describe('End-to-end job lifecycle', () => {
    it('should handle complete job lifecycle: PENDING -> PROCESSING -> READY', async () => {
      // Arrange
      const jobId = 'test-job-lifecycle';
      const r2Key = 'uploads/lifecycle.pdf';
      const metadata = {
        fileName: 'lifecycle.pdf',
        fileSize: 12288,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;

      // Act & Assert - Create
      const job1 = await repository.create(jobId, r2Key, metadata);
      expect(job1.status).toBe('PENDING');
      expect(job1.r2Key).toBe(r2Key);

      // Act & Assert - Processing
      await repository.updateStatusToProcessing(jobId);
      const job2 = await repository.getById(jobId);
      expect(job2?.status).toBe('PROCESSING');

      // Act & Assert - Ready
      const draft: WorkNoteDraft = {
        title: 'Lifecycle Test',
        content: 'Complete lifecycle test',
        category: 'Test',
        todos: [],
      };
      await repository.updateStatusToReady(jobId, draft);
      const job3 = await repository.getById(jobId);
      expect(job3?.status).toBe('READY');
      expect(job3?.draftJson).toBe(JSON.stringify(draft));
      expect(job3?.r2Key).toBeNull();
    });

    it('should handle error path: PENDING -> PROCESSING -> ERROR', async () => {
      // Arrange
      const jobId = 'test-job-error-path';
      const r2Key = 'uploads/error.pdf';
      const metadata = {
        fileName: 'error.pdf',
        fileSize: 13312,
        mimeType: 'application/pdf',
      } as unknown as PdfUploadMetadata;

      // Act & Assert - Create
      const job1 = await repository.create(jobId, r2Key, metadata);
      expect(job1.status).toBe('PENDING');

      // Act & Assert - Processing
      await repository.updateStatusToProcessing(jobId);
      const job2 = await repository.getById(jobId);
      expect(job2?.status).toBe('PROCESSING');

      // Act & Assert - Error
      await repository.updateStatusToError(jobId, 'Extraction failed');
      const job3 = await repository.getById(jobId);
      expect(job3?.status).toBe('ERROR');
      expect(job3?.errorMessage).toBe('Extraction failed');
      expect(job3?.r2Key).toBeNull();
    });
  });
});
