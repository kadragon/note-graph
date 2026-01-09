// Trace: TASK-016
// Unit tests for validation utilities

import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '@worker/middleware/validation-middleware';
import { ValidationError } from '@worker/types/errors';
import { validateBody, validateParams, validateQuery } from '@worker/utils/validation';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('Validation Utilities', () => {
  describe('validateBody()', () => {
    it('should validate valid request body', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ name: 'John', age: 30 }),
        },
      } as unknown as Context;

      const result = await validateBody(mockContext, schema);

      expect(result).toEqual({ name: 'John', age: 30 });
      expect(mockContext.req.json).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError for invalid body', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ name: 'John', age: 'invalid' }),
        },
      } as unknown as Context;

      await expect(validateBody(mockContext, schema)).rejects.toThrow(ValidationError);
      await expect(validateBody(mockContext, schema)).rejects.toThrow('Request validation failed');
    });

    it('should throw ValidationError for missing required fields', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ name: 'John' }),
        },
      } as unknown as Context;

      await expect(validateBody(mockContext, schema)).rejects.toThrow(ValidationError);
    });
  });

  describe('validateQuery()', () => {
    it('should validate valid query parameters', () => {
      const schema = z.object({
        page: z.string(),
        limit: z.string(),
      });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ page: '1', limit: '10' }),
        },
      } as unknown as Context;

      const result = validateQuery(mockContext, schema);

      expect(result).toEqual({ page: '1', limit: '10' });
      expect(mockContext.req.query).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError for invalid query params', () => {
      const schema = z.object({
        page: z.string(),
        limit: z.coerce.number(),
      });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ page: '1', limit: 'invalid' }),
        },
      } as unknown as Context;

      expect(() => validateQuery(mockContext, schema)).toThrow(ValidationError);
      expect(() => validateQuery(mockContext, schema)).toThrow('Query validation failed');
    });
  });

  describe('validateParams()', () => {
    it('should validate valid URL parameters', () => {
      const schema = z.object({
        id: z.string(),
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue({ id: 'WORK-001' }),
        },
      } as unknown as Context;

      const result = validateParams(mockContext, schema);

      expect(result).toEqual({ id: 'WORK-001' });
      expect(mockContext.req.param).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError for invalid params', () => {
      const schema = z.object({
        id: z.string().regex(/^WORK-\d+$/),
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue({ id: 'invalid' }),
        },
      } as unknown as Context;

      expect(() => validateParams(mockContext, schema)).toThrow(ValidationError);
      expect(() => validateParams(mockContext, schema)).toThrow('Parameter validation failed');
    });

    it('should throw ValidationError for missing required params', () => {
      const schema = z.object({
        id: z.string(),
        action: z.string(),
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue({ id: 'WORK-001' }),
        },
      } as unknown as Context;

      expect(() => validateParams(mockContext, schema)).toThrow(ValidationError);
    });
  });

  describe('Integration - Real-world schemas', () => {
    it('should validate work note creation request', async () => {
      const createWorkNoteSchema = z.object({
        title: z.string().min(1).max(200),
        contentRaw: z.string().min(1),
        category: z.enum(['업무', '회의', '보고', '아이디어', '기타']),
        personIds: z.array(z.string()).optional(),
      });

      const validData = {
        title: '2024 Q1 업무 계획',
        contentRaw: '올해 1분기 주요 업무 계획입니다.',
        category: '업무',
        personIds: ['P-001', 'P-002'],
      };

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue(validData),
        },
      } as unknown as Context;

      const result = await validateBody(mockContext, createWorkNoteSchema);
      expect(result).toEqual(validData);
    });
  });

  describe('Validation middleware', () => {
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
});
