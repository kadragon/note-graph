// Trace: SPEC-pdf-1, TASK-014
// PDF job types for async PDF processing

export type PdfJobStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';

/**
 * Metadata hints for AI draft generation
 */
export interface PdfUploadMetadata {
  category?: string;
  personIds?: string[];
  deptName?: string;
}

/**
 * PDF Job entity (database model)
 */
export interface PdfJob {
  jobId: string;
  status: PdfJobStatus;
  r2Key: string | null;
  extractedText: string | null;
  draftJson: string | null;
  errorMessage: string | null;
  metadataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Work note draft structure (returned in API)
 */
export interface WorkNoteDraft {
  title: string;
  content: string;
  category: string;
  todos: Array<{
    title: string;
    description?: string;
    dueDate?: string;
  }>;
}

/**
 * PDF Job response for API
 */
export interface PdfJobResponse {
  jobId: string;
  status: PdfJobStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  draft?: WorkNoteDraft;
}

/**
 * Queue message for PDF processing
 */
export interface PdfQueueMessage {
  jobId: string;
  r2Key: string;
  metadata: PdfUploadMetadata;
}

/**
 * PDF upload request
 */
export interface PdfUploadRequest {
  file: File | Blob;
  category?: string;
  personIds?: string;
  deptName?: string;
}
