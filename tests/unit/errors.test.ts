// Trace: TASK-016
// Unit tests for domain error classes

import {
  BadRequestError,
  ConflictError,
  DomainError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@worker/types/errors';
import { describe, expect, test } from 'vitest';

describe('Domain Errors', () => {
  test('base error exposes code, status, and optional details', () => {
    const error = new DomainError('Test error', 'TEST_ERROR', 500, { foo: 'bar' });

    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ foo: 'bar' });
  });

  test.each([
    {
      name: 'NotFoundError',
      create: () => new NotFoundError('Work note', 'WORK-123'),
      code: 'NOT_FOUND',
      statusCode: 404,
    },
    {
      name: 'ValidationError',
      create: () => new ValidationError('Invalid input'),
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    },
    {
      name: 'ConflictError',
      create: () => new ConflictError('Resource already exists'),
      code: 'CONFLICT',
      statusCode: 409,
    },
    {
      name: 'BadRequestError',
      create: () => new BadRequestError('Invalid request format'),
      code: 'BAD_REQUEST',
      statusCode: 400,
    },
    {
      name: 'RateLimitError',
      create: () => new RateLimitError(),
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    },
  ])('maps $name to expected code/status', ({ create, code, statusCode }) => {
    const error = create();

    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(statusCode);
  });
});
