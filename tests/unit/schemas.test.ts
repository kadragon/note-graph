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

      it('should reject title longer than 200 characters', () => {
        const invalidData = {
          title: 'a'.repeat(201),
          contentRaw: 'Content',
        };

        const result = createWorkNoteSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should accept title exactly 200 characters', () => {
        const validData = {
          title: 'a'.repeat(200),
          contentRaw: 'Content',
        };

        const result = createWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should allow optional fields to be omitted', () => {
        const validData = {
          title: 'Simple Note',
          contentRaw: 'Content',
        };

        const result = createWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.persons).toBeUndefined();
          expect(result.data.relatedWorkIds).toBeUndefined();
        }
      });

      it('should validate person associations', () => {
        const validData = {
          title: 'Test',
          contentRaw: 'Content',
          persons: [
            { personId: '123456', role: 'OWNER' },
            { personId: '654321', role: 'RELATED' },
          ],
        };

        const result = createWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should handle Korean text in fields', () => {
        const validData = {
          title: '한글 제목입니다',
          contentRaw: '한글 내용입니다',
          category: '회의',
        };

        const result = createWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
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

      it('should allow updating all fields', () => {
        const validData = {
          title: 'Updated',
          contentRaw: 'Updated content',
          category: '업무',
          persons: [{ personId: '123456', role: 'OWNER' }],
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

      it('should allow empty update object', () => {
        const validData = {};

        const result = updateWorkNoteSchema.safeParse(validData);
        expect(result.success).toBe(true);
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

      it('should validate RELATED role', () => {
        const validData = {
          personId: '123456',
          role: 'RELATED',
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

      it('should validate query with filters', () => {
        const validData = {
          category: '회의',
          personId: '123456',
          deptName: '개발팀',
        };

        const result = listWorkNotesQuerySchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should validate ISO 8601 date-time strings', () => {
        const validData = {
          from: '2024-01-01T00:00:00Z',
          to: '2024-12-31T23:59:59Z',
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

      it('should accept valid 6-digit personId', () => {
        const validData = {
          personId: '000123',
          name: 'Test User',
        };

        const result = createPersonSchema.safeParse(validData);
        expect(result.success).toBe(true);
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

      it('should validate all fields when provided', () => {
        const validData = {
          name: '김철수',
          currentDept: '영업팀',
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
      it('should validate department description update', () => {
        const validData = {
          description: '신사업팀 설명',
        };

        const result = updateDepartmentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should allow empty update', () => {
        const validData = {};

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

      it('should validate with all filters', () => {
        const validData = {
          query: 'test',
          category: '회의',
          personId: '123456',
          deptName: '개발팀',
          from: '2024-01-01T00:00:00Z',
          to: '2024-12-31T23:59:59Z',
          limit: 20,
        };

        const result = searchWorkNotesSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should handle limit as number', () => {
        const validData = {
          query: 'test',
          limit: 10,
        };

        const result = searchWorkNotesSchema.safeParse(validData);
        expect(result.success).toBe(true);
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

      it('should validate all scope types', () => {
        const scopes = ['GLOBAL', 'PERSON', 'DEPARTMENT', 'WORK'];

        scopes.forEach((scope) => {
          const validData = {
            query: 'test',
            scope,
          };

          const result = ragQuerySchema.safeParse(validData);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid scope', () => {
        const invalidData = {
          query: 'test',
          scope: 'INVALID',
        };

        const result = ragQuerySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should validate topK parameter', () => {
        const validData = {
          query: 'test',
          topK: 10,
        };

        const result = ragQuerySchema.safeParse(validData);
        expect(result.success).toBe(true);
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

  describe('Type Inference', () => {
    it('should infer correct types from schemas', () => {
      const validData = {
        title: 'Test',
        contentRaw: 'Content',
        category: '업무',
      };

      const parsed = createWorkNoteSchema.parse(validData);

      // Type assertions to verify inference
      expect(typeof parsed.title).toBe('string');
      expect(typeof parsed.contentRaw).toBe('string');
      expect(parsed.category).toBe('업무');
    });
  });
});
