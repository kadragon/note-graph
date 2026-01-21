// Integration tests for error serialization and HTTP status mapping
// Consolidated from tests/unit/errors.test.ts

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@worker/types/errors';
import { describe, expect, it } from 'vitest';

describe('Error serialization and HTTP status mapping', () => {
  it('NotFoundError maps to 404 status', () => {
    const error = new NotFoundError('Work note', 'WORK-123');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('ValidationError maps to 400 status', () => {
    const error = new ValidationError('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
  });

  it('ConflictError maps to 409 status', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
  });

  it('BadRequestError maps to 400 status', () => {
    const error = new BadRequestError('Invalid request format');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
  });

  it('RateLimitError maps to 429 status', () => {
    const error = new RateLimitError();
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.statusCode).toBe(429);
  });
});
