// Trace: SPEC-pdf-1, TASK-015
// PDF text extraction service using unpdf

import { extractText } from 'unpdf';
import {
  EncryptedPdfError,
  CorruptPdfError,
  EmptyPdfError,
  PdfProcessingError,
} from '../types/errors.js';

/**
 * PdfExtractionService
 * Extracts text from PDF files using unpdf library
 */
export class PdfExtractionService {
  /**
   * Extract text from PDF buffer
   * @param pdfBuffer - PDF file as ArrayBuffer or Uint8Array
   * @returns Extracted text content
   * @throws Error if extraction fails
   */
  async extractText(pdfBuffer: ArrayBuffer | Uint8Array): Promise<string> {
    try {
      // extractText returns { totalPages, text: string } when mergePages: true
      const result = await extractText(pdfBuffer, { mergePages: true });
      const text = result.text;

      // Check if text was extracted
      if (!text || text.trim().length === 0) {
        throw new EmptyPdfError();
      }

      return text.trim();
    } catch (error) {
      // Re-throw custom PDF errors
      if (
        error instanceof EncryptedPdfError ||
        error instanceof CorruptPdfError ||
        error instanceof EmptyPdfError
      ) {
        throw error;
      }

      // Handle unpdf library errors
      if (error instanceof Error) {
        // Check for encryption/password errors
        if (
          error.message.includes('encrypted') ||
          error.message.includes('password')
        ) {
          throw new EncryptedPdfError();
        }
        // Check for corruption errors
        if (error.message.includes('invalid') || error.message.includes('corrupt')) {
          throw new CorruptPdfError();
        }
      }

      // Generic PDF processing error
      throw new PdfProcessingError(
        `PDF 텍스트 추출 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate PDF buffer (basic checks)
   * @param buffer - PDF file buffer
   * @returns true if valid, throws error if invalid
   */
  validatePdfBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
    const uint8Array =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    // Check minimum size (a valid PDF must be at least a few bytes)
    if (uint8Array.length < 100) {
      throw new CorruptPdfError();
    }

    // Check PDF header (%PDF-)
    const header = String.fromCharCode(...uint8Array.slice(0, 5));
    if (header !== '%PDF-') {
      throw new CorruptPdfError();
    }

    return true;
  }
}
