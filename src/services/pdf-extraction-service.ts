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
  // PDF signature bytes: %PDF-
  private static readonly PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

  /**
   * Normalize PDF buffer by extracting embedded PDF from wrapper formats
   * Supports: Standard PDF, Handysoft Approval Document, and other wrapped formats
   * @param buffer - Original file buffer
   * @returns Normalized PDF buffer starting with %PDF- signature
   * @throws CorruptPdfError if no PDF signature found
   */
  private normalizePdfBuffer(buffer: ArrayBuffer | Uint8Array): Uint8Array {
    const uint8Array =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    // Check if already starts with PDF signature
    if (this.startsWithPdfSignature(uint8Array)) {
      return uint8Array;
    }

    // Search for PDF signature in the buffer (for wrapped formats like Handysoft)
    const pdfOffset = this.findPdfSignatureOffset(uint8Array);

    if (pdfOffset === -1) {
      throw new CorruptPdfError();
    }

    // Extract PDF portion from the wrapper
    return uint8Array.slice(pdfOffset);
  }

  /**
   * Check if buffer starts with PDF signature
   */
  private startsWithPdfSignature(buffer: Uint8Array): boolean {
    if (buffer.length < 5) return false;
    return PdfExtractionService.PDF_SIGNATURE.every(
      (byte, index) => buffer[index] === byte
    );
  }

  /**
   * Find PDF signature offset in buffer
   * @returns Offset position or -1 if not found
   */
  private findPdfSignatureOffset(buffer: Uint8Array): number {
    const signature = PdfExtractionService.PDF_SIGNATURE;
    const maxSearchLength = Math.min(buffer.length - 5, 10000); // Search first 10KB

    for (let i = 0; i <= maxSearchLength; i++) {
      if (signature.every((byte, index) => buffer[i + index] === byte)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Extract text from PDF buffer
   * @param pdfBuffer - PDF file as ArrayBuffer or Uint8Array
   * @returns Extracted text content
   * @throws Error if extraction fails
   */
  async extractText(pdfBuffer: ArrayBuffer | Uint8Array): Promise<string> {
    try {
      // Normalize buffer to handle wrapped formats (e.g., Handysoft)
      const normalizedBuffer = this.normalizePdfBuffer(pdfBuffer);

      // extractText returns { totalPages, text: string } when mergePages: true
      const result = await extractText(normalizedBuffer, { mergePages: true });
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
   * Supports wrapped formats like Handysoft Approval Document
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

    // Check for PDF signature (either at start or embedded in wrapper)
    if (!this.startsWithPdfSignature(uint8Array)) {
      const pdfOffset = this.findPdfSignatureOffset(uint8Array);
      if (pdfOffset === -1) {
        throw new CorruptPdfError();
      }
    }

    return true;
  }
}
