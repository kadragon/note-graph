// Trace: SPEC-pdf-1, TASK-015
// PDF text extraction service using unpdf

import { extractText } from 'unpdf';

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
        throw new Error('PDF에서 텍스트를 추출할 수 없습니다 (이미지 PDF일 수 있음)');
      }

      return text.trim();
    } catch (error) {
      // Handle specific unpdf errors
      if (error instanceof Error) {
        // Check for common PDF issues
        if (
          error.message.includes('encrypted') ||
          error.message.includes('password')
        ) {
          throw new Error('지원하지 않는 PDF 형식입니다 (암호화된 PDF)');
        }
        if (error.message.includes('invalid') || error.message.includes('corrupt')) {
          throw new Error('손상된 PDF 파일입니다');
        }
        // Re-throw with existing message if already formatted
        if (error.message.includes('텍스트를 추출할 수 없습니다')) {
          throw error;
        }
      }

      // Generic error
      throw new Error(
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
      throw new Error('PDF 파일이 너무 작습니다 (손상되었을 수 있음)');
    }

    // Check PDF header (%PDF-)
    const header = String.fromCharCode(...uint8Array.slice(0, 5));
    if (header !== '%PDF-') {
      throw new Error('유효한 PDF 파일이 아닙니다');
    }

    return true;
  }
}
