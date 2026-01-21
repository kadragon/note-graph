// Trace: TASK-016
// Unit tests for validation middleware (context attachment)
// Consolidated from tests/unit/validation.test.ts

import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '@worker/middleware/validation-middleware';
import { ValidationError } from '@worker/types/errors';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('Validation Middleware', () => {
  it('should validate request body and attach to context', async () => {
    const schema = z.object({
      title: z.string(),
      count: z.number(),
    });

    const stored = new Map<string, unknown>();
    const mockContext = {
      req: {
        json: vi.fn().mockResolvedValue({ title: 'Test', count: 2 }),
      },
      set: vi.fn((key: string, value: unknown) => {
        stored.set(key, value);
      }),
      get: vi.fn((key: string) => stored.get(key)),
    } as unknown as Context;

    const next = vi.fn().mockResolvedValue(undefined);

    await bodyValidator(schema)(mockContext, next);

    expect(mockContext.set).toHaveBeenCalledWith('body', { title: 'Test', count: 2 });
    expect(mockContext.get('body')).toEqual({ title: 'Test', count: 2 });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should validate query and attach to context', async () => {
    const schema = z.object({
      page: z.string(),
    });

    const stored = new Map<string, unknown>();
    const mockContext = {
      req: {
        query: vi.fn().mockReturnValue({ page: '1' }),
      },
      set: vi.fn((key: string, value: unknown) => {
        stored.set(key, value);
      }),
      get: vi.fn((key: string) => stored.get(key)),
    } as unknown as Context;

    const next = vi.fn().mockResolvedValue(undefined);

    await queryValidator(schema)(mockContext, next);

    expect(mockContext.set).toHaveBeenCalledWith('query', { page: '1' });
    expect(mockContext.get('query')).toEqual({ page: '1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should throw ValidationError for invalid body', async () => {
    const schema = z.object({
      title: z.string(),
      count: z.number(),
    });

    const mockContext = {
      req: {
        json: vi.fn().mockResolvedValue({ title: 'Test', count: 'nope' }),
      },
      set: vi.fn(),
    } as unknown as Context;

    const next = vi.fn().mockResolvedValue(undefined);

    await expect(bodyValidator(schema)(mockContext, next)).rejects.toThrow(ValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw helpful error when getValidatedBody called without middleware', () => {
    const mockContext = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Context;

    const schema = z.object({ name: z.string() });

    expect(() => getValidatedBody<typeof schema>(mockContext)).toThrow(
      'Validated body not found in context. Did you forget to apply bodyValidator middleware before this handler?'
    );
  });

  it('should throw helpful error when getValidatedQuery called without middleware', () => {
    const mockContext = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Context;

    const schema = z.object({ page: z.string() });

    expect(() => getValidatedQuery<typeof schema>(mockContext)).toThrow(
      'Validated query not found in context. Did you forget to apply queryValidator middleware before this handler?'
    );
  });
});
