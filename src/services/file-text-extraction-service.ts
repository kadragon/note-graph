// Trace: SPEC-project-1, TASK-042
/**
 * File text extraction service for project files
 * Supports PDF and TXT files in Cloudflare Workers environment
 */

import { PdfExtractionService } from './pdf-extraction-service.js';

/**
 * Result of text extraction attempt
 */
export interface TextExtractionResult {
  /** Whether text was successfully extracted */
  success: boolean;
  /** Extracted text content (if successful) */
  text?: string;
  /** Reason for failure (if unsuccessful) */
  reason?: string;
}

/**
 * MIME types that support text extraction
 */
export const TEXT_EXTRACTABLE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

/**
 * FileTextExtractionService
 *
 * Extracts text from uploaded files for embedding.
 *
 * Supported formats:
 * - PDF: Uses unpdf library (via PdfExtractionService)
 * - TXT/Markdown: Direct text reading
 *
 * Note: DOCX support is not available in Workers environment due to
 * lack of compatible libraries. Consider external service integration
 * if DOCX support is required.
 */
export class FileTextExtractionService {
  private pdfExtractor: PdfExtractionService;

  constructor() {
    this.pdfExtractor = new PdfExtractionService();
  }

  /**
   * Check if a MIME type supports text extraction
   */
  static isTextExtractable(mimeType: string): boolean {
    return TEXT_EXTRACTABLE_MIME_TYPES.includes(
      mimeType as (typeof TEXT_EXTRACTABLE_MIME_TYPES)[number]
    );
  }

  /**
   * Extract text from file
   *
   * @param file - File blob
   * @param mimeType - MIME type of the file
   * @returns Extraction result with text or failure reason
   */
  async extractText(file: Blob, mimeType: string): Promise<TextExtractionResult> {
    // Check if file type supports extraction
    if (!FileTextExtractionService.isTextExtractable(mimeType)) {
      return {
        success: false,
        reason: `파일 형식 ${mimeType}은 텍스트 추출이 지원되지 않습니다.`,
      };
    }

    try {
      let text: string;

      // Extract based on MIME type
      if (mimeType === 'application/pdf') {
        text = await this.extractFromPdf(file);
      } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        text = await this.extractFromText(file);
      } else {
        return {
          success: false,
          reason: `지원되지 않는 파일 형식입니다: ${mimeType}`,
        };
      }

      // Validate extracted text
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          reason: '파일에서 텍스트를 추출할 수 없습니다 (빈 파일 또는 이미지 전용).',
        };
      }

      return {
        success: true,
        text: text.trim(),
      };
    } catch (error) {
      return {
        success: false,
        reason: `텍스트 추출 중 오류 발생: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Extract text from PDF file
   */
  private async extractFromPdf(file: Blob): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.pdfExtractor.extractText(arrayBuffer);
  }

  /**
   * Extract text from plain text file
   */
  private async extractFromText(file: Blob): Promise<string> {
    const text = await file.text();
    return text.trim();
  }
}
