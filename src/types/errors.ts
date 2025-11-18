// Trace: SPEC-worknote-1, TASK-004
/**
 * Domain error classes for consistent error handling
 */

/**
 * Base domain error class
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Conflict error (409) - e.g., duplicate resource
 */
export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'BAD_REQUEST', 400, details);
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitError extends DomainError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

/**
 * PDF-specific errors (400)
 */
export class PdfProcessingError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'PDF_PROCESSING_ERROR', 400, details);
  }
}

/**
 * Encrypted PDF error (400)
 */
export class EncryptedPdfError extends DomainError {
  constructor() {
    super('지원하지 않는 PDF 형식입니다 (암호화된 PDF)', 'PDF_ENCRYPTED', 400, { type: 'encrypted' });
  }
}

/**
 * Corrupt PDF error (400)
 */
export class CorruptPdfError extends DomainError {
  constructor() {
    super('손상된 PDF 파일입니다', 'PDF_CORRUPT', 400, { type: 'corrupt' });
  }
}

/**
 * Empty PDF error (400)
 */
export class EmptyPdfError extends DomainError {
  constructor() {
    super('PDF에서 텍스트를 추출할 수 없습니다 (이미지 PDF일 수 있음)', 'PDF_EMPTY', 400, { type: 'empty' });
  }
}
