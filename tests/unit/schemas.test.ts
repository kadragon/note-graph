// Trace: SPEC-worknote-1, TASK-004, TASK-016
// Unit tests for Zod validation schemas

import { createDepartmentSchema, updateDepartmentSchema } from '@worker/schemas/department';
import { createPersonSchema, updatePersonSchema } from '@worker/schemas/person';
import { ragQuerySchema, searchWorkNotesSchema } from '@worker/schemas/search';
import {
  createWorkNoteSchema,
  listWorkNotesQuerySchema,
  updateWorkNoteSchema,
  workNotePersonSchema,
} from '@worker/schemas/work-note';
import { describe, expect, it } from 'vitest';

describe('Schema Validation', () => {
  describe('Work Note Schemas', () => {
    describe('createWorkNoteSchema', () => {
      it('should validate valid work note creation', () => {
        const validData = {
          title: '업무 보고서',
          contentRaw: '2024년 1분기 업무 내용입니다.',
          category: '보고',
          persons: [{ personId: '123456', role: 'OWNER' }],
          relatedWorkIds: ['WORK-123'],
        };

        const result = createWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('업무 보고서');
          expect(result.data.category).toBe('보고');
        }
      });

      it('should require title and contentRaw', () => {
        const invalidData = {};

        const result = createWorkNoteSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });

      it('should reject empty title', () => {
        const invalidData = {
          title: '',
          contentRaw: 'Content',
        };

        const result = createWorkNoteSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('updateWorkNoteSchema', () => {
      it('should allow partial updates', () => {
        const validData = {
          title: 'Updated Title',
        };

        const result = updateWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should allow updating only content', () => {
        const validData = {
          contentRaw: 'Updated content',
        };

        const result = updateWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty title if provided', () => {
        const invalidData = {
          title: '',
        };

        const result = updateWorkNoteSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('workNotePersonSchema', () => {
      it('should validate OWNER role', () => {
        const validData = {
          personId: '123456',
          role: 'OWNER',
        };

        const result = workNotePersonSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid role', () => {
        const invalidData = {
          personId: '123456',
          role: 'INVALID',
        };

        const result = workNotePersonSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should require personId length of 6', () => {
        const invalidData = {
          personId: '12345',
          role: 'OWNER',
        };

        const result = workNotePersonSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('listWorkNotesQuerySchema', () => {
      it('should validate empty query', () => {
        const validData = {};

        const result = listWorkNotesQuerySchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should validate query with search term', () => {
        const validData = {
          q: '업무 보고',
        };

        const result = listWorkNotesQuerySchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid date format', () => {
        const invalidData = {
          from: '2024-01-01',
          to: '2024-12-31',
        };

        const result = listWorkNotesQuerySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Person Schemas', () => {
    describe('createPersonSchema', () => {
      it('should validate valid person creation', () => {
        const validData = {
          personId: '123456',
          name: '홍길동',
          currentDept: '개발팀',
        };

        const result = createPersonSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should require personId and name', () => {
        const invalidData = {
          personId: '123456',
        };

        const result = createPersonSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should validate personId format (6 digits)', () => {
        const invalidData = {
          personId: 'P-0001',
          name: 'Test',
          currentDept: 'Dept',
        };

        const result = createPersonSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('updatePersonSchema', () => {
      it('should allow partial updates', () => {
        const validData = {
          currentDept: '마케팅팀',
        };

        const result = updatePersonSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Department Schemas', () => {
    describe('createDepartmentSchema', () => {
      it('should validate valid department creation', () => {
        const validData = {
          deptName: '개발팀',
        };

        const result = createDepartmentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should require deptName', () => {
        const invalidData = {};

        const result = createDepartmentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty deptName', () => {
        const invalidData = {
          deptName: '',
        };

        const result = createDepartmentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('updateDepartmentSchema', () => {
      it('should allow partial updates', () => {
        const validData = {
          description: '신규 설명',
        };

        const result = updateDepartmentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Search Schemas', () => {
    describe('searchWorkNotesSchema', () => {
      it('should validate basic search query', () => {
        const validData = {
          query: '업무 보고서',
        };

        const result = searchWorkNotesSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(10); // Default limit
        }
      });

      it('should require search query', () => {
        const invalidData = {};

        const result = searchWorkNotesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty search query', () => {
        const invalidData = {
          query: '',
        };

        const result = searchWorkNotesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject limit over 100', () => {
        const invalidData = {
          query: 'test',
          limit: 150,
        };

        const result = searchWorkNotesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('ragQuerySchema', () => {
      it('should validate basic RAG query', () => {
        const validData = {
          query: '업무 관련 내용 검색',
        };

        const result = ragQuerySchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe('GLOBAL'); // Default
          expect(result.data.topK).toBe(5); // Default
        }
      });

      it('should reject invalid scope', () => {
        const invalidData = {
          query: 'test',
          scope: 'INVALID',
        };

        const result = ragQuerySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject topK over 20', () => {
        const invalidData = {
          query: 'test',
          topK: 25,
        };

        const result = ragQuerySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});
