// Unit tests for PdfExtractionService
import { beforeEach, describe, expect, it } from 'vitest';
import { PdfExtractionService } from '../../src/services/pdf-extraction-service';
import { CorruptPdfError } from '../../src/types/errors';

describe('PdfExtractionService', () => {
  let service: PdfExtractionService;

  beforeEach(() => {
    service = new PdfExtractionService();
  });

  describe('validatePdfBuffer()', () => {
    it('should validate a valid PDF buffer', () => {
      // Arrange - Create a minimal PDF header
      const pdfHeader = '%PDF-1.4\n';
      const buffer = new TextEncoder().encode(pdfHeader + 'x'.repeat(100));

      // Act & Assert
      expect(() => service.validatePdfBuffer(buffer)).not.toThrow();
      expect(service.validatePdfBuffer(buffer)).toBe(true);
    });

    it('should accept ArrayBuffer input', () => {
      // Arrange
      const pdfHeader = '%PDF-1.4\n';
      const uint8 = new TextEncoder().encode(pdfHeader + 'x'.repeat(100));
      const arrayBuffer = uint8.buffer;

      // Act & Assert
      expect(() => service.validatePdfBuffer(arrayBuffer)).not.toThrow();
    });

    it('should reject buffer that is too small', () => {
      // Arrange - Buffer less than 100 bytes
      const smallBuffer = new TextEncoder().encode('%PDF-1.4\n');

      // Act & Assert
      expect(() => service.validatePdfBuffer(smallBuffer)).toThrow(CorruptPdfError);
    });

    it('should reject buffer without PDF header', () => {
      // Arrange - No PDF header
      const invalidBuffer = new TextEncoder().encode(`not a pdf file${'x'.repeat(100)}`);

      // Act & Assert
      expect(() => service.validatePdfBuffer(invalidBuffer)).toThrow(CorruptPdfError);
    });

    it('should reject buffer with incorrect header', () => {
      // Arrange - Wrong header
      const invalidBuffer = new TextEncoder().encode(`%DOC-1.0\n${'x'.repeat(100)}`);

      // Act & Assert
      expect(() => service.validatePdfBuffer(invalidBuffer)).toThrow(CorruptPdfError);
    });

    it('should validate PDF with different version numbers', () => {
      // Arrange - Various PDF versions
      const versions = ['%PDF-1.0', '%PDF-1.2', '%PDF-1.4', '%PDF-1.7', '%PDF-2.0'];

      // Act & Assert
      versions.forEach((header) => {
        const buffer = new TextEncoder().encode(`${header}\n${'x'.repeat(100)}`);
        expect(() => service.validatePdfBuffer(buffer)).not.toThrow();
      });
    });

    it('should validate minimum PDF structure', () => {
      // Arrange - Exactly 100 bytes (minimum allowed)
      const pdfHeader = '%PDF-1.4\n';
      const paddingLength = 100 - pdfHeader.length;
      const buffer = new TextEncoder().encode(pdfHeader + 'x'.repeat(paddingLength));

      // Act & Assert
      expect(buffer.length).toBe(100);
      expect(() => service.validatePdfBuffer(buffer)).not.toThrow();
    });

    it('should reject buffer one byte under minimum', () => {
      // Arrange - 99 bytes (one under minimum)
      const pdfHeader = '%PDF-1.4\n';
      const paddingLength = 99 - pdfHeader.length;
      const buffer = new TextEncoder().encode(pdfHeader + 'x'.repeat(paddingLength));

      // Act & Assert
      expect(buffer.length).toBe(99);
      expect(() => service.validatePdfBuffer(buffer)).toThrow(CorruptPdfError);
    });

    it('should validate large PDF buffer', () => {
      // Arrange - Large buffer (1 MB)
      const pdfHeader = '%PDF-1.4\n';
      const buffer = new TextEncoder().encode(pdfHeader + 'x'.repeat(1024 * 1024));

      // Act & Assert
      expect(() => service.validatePdfBuffer(buffer)).not.toThrow();
    });

    it('should validate wrapped PDF formats (e.g., Handysoft)', () => {
      // Arrange - PDF with wrapper header (like Handysoft Approval Document)
      const buffer = new TextEncoder().encode(
        `Handysoft Approval Document File${'\x00'.repeat(100)}%PDF-1.4\n${'x'.repeat(100)}`
      );

      // Act & Assert - should not throw because PDF signature exists in wrapper
      expect(() => service.validatePdfBuffer(buffer)).not.toThrow();
    });

    it('should reject buffer with no PDF signature anywhere', () => {
      // Arrange - No PDF signature at all
      const buffer = new TextEncoder().encode(
        'Not a PDF file at all, just random text content here'.repeat(10)
      );

      // Act & Assert
      expect(() => service.validatePdfBuffer(buffer)).toThrow(CorruptPdfError);
    });
  });

  // Note on extractText() tests:
  // Unit tests for extractText() require mocking the unpdf library, which is not
  // compatible with the Cloudflare Workers test environment. The unpdf module cannot
  // be properly mocked using vi.mock() in this runtime.
  //
  // Error handling coverage:
  // - The error mapping logic (EncryptedPdfError, CorruptPdfError, EmptyPdfError,
  //   PdfProcessingError) is tested indirectly through integration tests and validated
  //   by code review.
  // - The unpdf library itself is well-tested by its maintainers.
  //
  // Alternative testing approaches:
  // 1. Integration tests with real PDF files in an E2E testing environment
  // 2. Manual testing with various PDF types (encrypted, corrupt, empty, valid)
  // 3. Monitor error logs in production for proper error classification
});
