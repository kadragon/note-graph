// Unit tests for PdfExtractionService
import { describe, it, expect } from 'vitest';
import { PdfExtractionService } from '../../src/services/pdf-extraction-service';
import {
  CorruptPdfError,
} from '../../src/types/errors';

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
      const invalidBuffer = new TextEncoder().encode('not a pdf file' + 'x'.repeat(100));

      // Act & Assert
      expect(() => service.validatePdfBuffer(invalidBuffer)).toThrow(CorruptPdfError);
    });

    it('should reject buffer with incorrect header', () => {
      // Arrange - Wrong header
      const invalidBuffer = new TextEncoder().encode('%DOC-1.0\n' + 'x'.repeat(100));

      // Act & Assert
      expect(() => service.validatePdfBuffer(invalidBuffer)).toThrow(CorruptPdfError);
    });

    it('should validate PDF with different version numbers', () => {
      // Arrange - Various PDF versions
      const versions = ['%PDF-1.0', '%PDF-1.2', '%PDF-1.4', '%PDF-1.7', '%PDF-2.0'];

      // Act & Assert
      versions.forEach((header) => {
        const buffer = new TextEncoder().encode(header + '\n' + 'x'.repeat(100));
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

    it('should validate PDF header at exact position', () => {
      // Arrange - PDF header must be at the start
      const buffer = new TextEncoder().encode('JUNK%PDF-1.4\n' + 'x'.repeat(100));

      // Act & Assert
      expect(() => service.validatePdfBuffer(buffer)).toThrow(CorruptPdfError);
    });
  });

  // Note: extractText() tests are omitted because they require:
  // 1. Complex mocking of the unpdf library that doesn't work well in Cloudflare Workers environment
  // 2. Real PDF files for integration testing
  //
  // The unpdf library is already tested by its maintainers, and our error handling
  // logic is covered by the validation tests above. Full integration tests should
  // be performed with actual PDF files in an end-to-end testing environment.
});
