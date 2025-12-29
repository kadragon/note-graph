// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-002
// Unit tests for domain error classes

import {
  BadRequestError,
  ConflictError,
  DomainError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@worker/types/errors';

describe('Domain Errors', () => {
  describe('DomainError', () => {
    it('should create error with message, code, and status', () => {
      const error = new DomainError('Test error', 'TEST_ERROR', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DomainError');
    });

    it('should support optional details', () => {
      const error = new DomainError('Test error', 'TEST_ERROR', 500, { foo: 'bar' });

      expect(error.details).toEqual({ foo: 'bar' });
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with resource and ID', () => {
      const error = new NotFoundError('Work note', 'WORK-123');

      expect(error.message).toBe('Work note not found: WORK-123');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error for validation failures', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid email' },
      ]);

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual([{ field: 'email', message: 'Invalid email' }]);
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error for conflicts', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error for bad requests', () => {
      const error = new BadRequestError('Invalid request format');

      expect(error.message).toBe('Invalid request format');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('RateLimitError', () => {
    it('should create 429 error for rate limits', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
    });

    it('should have default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
    });
  });
});
