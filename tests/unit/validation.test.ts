// Trace: TASK-016
// Unit tests for validation utilities

import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../../src/types/errors';
import { validateBody, validateParams, validateQuery } from '../../src/utils/validation';

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

    it('should handle complex nested schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            location: z.string(),
          }),
        }),
      });

      const validData = {
        user: {
          name: 'Alice',
          profile: {
            age: 25,
            location: 'Seoul',
          },
        },
      };

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue(validData),
        },
      } as unknown as Context;

      const result = await validateBody(mockContext, schema);
      expect(result).toEqual(validData);
    });

    it('should validate array schemas', async () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ items: ['a', 'b', 'c'] }),
        },
      } as unknown as Context;

      const result = await validateBody(mockContext, schema);
      expect(result.items).toHaveLength(3);
    });

    it('should rethrow non-Zod errors', async () => {
      const schema = z.object({ name: z.string() });
      const customError = new Error('JSON parse error');

      const mockContext = {
        req: {
          json: vi.fn().mockRejectedValue(customError),
        },
      } as unknown as Context;

      await expect(validateBody(mockContext, schema)).rejects.toThrow('JSON parse error');
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

    it('should handle optional query parameters', () => {
      const schema = z.object({
        search: z.string().optional(),
        filter: z.string().optional(),
      });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ search: 'test' }),
        },
      } as unknown as Context;

      const result = validateQuery(mockContext, schema);
      expect(result.search).toBe('test');
      expect(result.filter).toBeUndefined();
    });

    it('should validate with default values', () => {
      const schema = z.object({
        page: z.string().default('1'),
        limit: z.string().default('10'),
      });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({}),
        },
      } as unknown as Context;

      const result = validateQuery(mockContext, schema);
      expect(result.page).toBe('1');
      expect(result.limit).toBe('10');
    });

    it('should handle multiple query parameters', () => {
      const schema = z.object({
        category: z.string(),
        from: z.string(),
        to: z.string(),
        limit: z.coerce.number().optional(),
      });

      const mockContext = {
        req: {
          query: vi
            .fn()
            .mockReturnValue({ category: '회의', from: '2024-01-01', to: '2024-12-31' }),
        },
      } as unknown as Context;

      const result = validateQuery(mockContext, schema);
      expect(result.category).toBe('회의');
      expect(result.from).toBe('2024-01-01');
      expect(result.to).toBe('2024-12-31');
    });

    it('should rethrow non-Zod errors', () => {
      const schema = z.object({ name: z.string() });
      const customError = new Error('Query parse error');

      const mockContext = {
        req: {
          query: vi.fn().mockImplementation(() => {
            throw customError;
          }),
        },
      } as unknown as Context;

      expect(() => validateQuery(mockContext, schema)).toThrow('Query parse error');
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

    it('should validate multiple URL parameters', () => {
      const schema = z.object({
        workId: z.string(),
        todoId: z.string(),
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue({ workId: 'WORK-001', todoId: 'TODO-001' }),
        },
      } as unknown as Context;

      const result = validateParams(mockContext, schema);
      expect(result.workId).toBe('WORK-001');
      expect(result.todoId).toBe('TODO-001');
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

    it('should validate params with transformations', () => {
      const schema = z.object({
        id: z.string().transform((val) => val.toUpperCase()),
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue({ id: 'work-001' }),
        },
      } as unknown as Context;

      const result = validateParams(mockContext, schema);
      expect(result.id).toBe('WORK-001');
    });

    it('should rethrow non-Zod errors', () => {
      const schema = z.object({ id: z.string() });
      const customError = new Error('Param parse error');

      const mockContext = {
        req: {
          param: vi.fn().mockImplementation(() => {
            throw customError;
          }),
        },
      } as unknown as Context;

      expect(() => validateParams(mockContext, schema)).toThrow('Param parse error');
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

    it('should validate search query parameters', () => {
      const searchQuerySchema = z.object({
        q: z.string().min(1),
        category: z.string().optional(),
        personId: z.string().optional(),
        deptName: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).default(10),
      });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({
            q: '업무 보고',
            category: '회의',
            limit: '20',
          }),
        },
      } as unknown as Context;

      const result = validateQuery(mockContext, searchQuerySchema);
      expect(result.q).toBe('업무 보고');
      expect(result.category).toBe('회의');
      expect(result.limit).toBe(20);
    });

    it('should reject invalid category in work note', async () => {
      const createWorkNoteSchema = z.object({
        title: z.string(),
        contentRaw: z.string(),
        category: z.enum(['업무', '회의', '보고', '아이디어', '기타']),
      });

      const invalidData = {
        title: 'Test',
        contentRaw: 'Content',
        category: 'invalid-category',
      };

      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue(invalidData),
        },
      } as unknown as Context;

      await expect(validateBody(mockContext, createWorkNoteSchema)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
