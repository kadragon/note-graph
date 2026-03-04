// Trace: SPEC-worknote-1, TASK-004, TASK-016
// Unit tests for Zod validation schemas

import { adminBatchQuerySchema, adminEmbeddingFailuresQuerySchema } from '@worker/schemas/admin';
import { enhanceWorkNoteRequestSchema } from '@worker/schemas/ai-draft';
import { createDepartmentSchema, updateDepartmentSchema } from '@worker/schemas/department';
import {
  createMeetingMinuteSchema,
  listMeetingMinutesQuerySchema,
  updateMeetingMinuteSchema,
} from '@worker/schemas/meeting-minute';
import { createPersonSchema, updatePersonSchema } from '@worker/schemas/person';
import { ragQuerySchema, searchWorkNotesSchema } from '@worker/schemas/search';
import { createTodoSchema, updateTodoSchema } from '@worker/schemas/todo';
import {
  createWorkNoteSchema,
  listWorkNotesQuerySchema,
  updateWorkNoteSchema,
  workNotePersonSchema,
} from '@worker/schemas/work-note';
import { describe, expect, it } from 'vitest';

describe('Schema Validation', () => {
  describe('Meeting Minute Schemas', () => {
    describe('createMeetingMinuteSchema', () => {
      it('should require meetingDate, topic, detailsRaw, and at least one attendeePersonId', () => {
        const invalidData = {
          meetingDate: '2026-02-10',
          topic: '주간 회의',
          detailsRaw: '회의 내용',
          attendeePersonIds: [],
        };

        const result = createMeetingMinuteSchema.safeParse(invalidData);
        expect(result.success).toBe(false);

        if (!result.success) {
          const paths = result.error.issues.map((issue) => issue.path.join('.'));
          expect(paths).toContain('attendeePersonIds');
        }
      });
    });

    describe('updateMeetingMinuteSchema', () => {
      it('should accept partial payload but reject invalid date/topic/details/attendee formats', () => {
        const validPartial = {
          topic: '업데이트된 회의 주제',
        };

        expect(updateMeetingMinuteSchema.safeParse(validPartial).success).toBe(true);

        const invalidCases = [
          { meetingDate: '2026-2-10' },
          { topic: '' },
          { detailsRaw: '' },
          { attendeePersonIds: ['12345'] },
          { attendeePersonIds: [] },
        ];

        for (const invalidCase of invalidCases) {
          expect(updateMeetingMinuteSchema.safeParse(invalidCase).success).toBe(false);
        }
      });

      describe('listMeetingMinutesQuerySchema', () => {
        it('applies defaults for missing pagination fields', () => {
          const result = listMeetingMinutesQuerySchema.safeParse({});
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
          }
        });

        it('falls back to defaults for invalid pagination values', () => {
          const result = listMeetingMinutesQuerySchema.safeParse({
            page: 'abc',
            pageSize: 'xyz',
          });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
          }
        });
      });
    });

    describe('Admin Schemas', () => {
      it('adminBatchQuerySchema applies batchSize default', () => {
        const result = adminBatchQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.batchSize).toBe(10);
        }
      });

      it('adminEmbeddingFailuresQuerySchema applies defaults and clamps negatives', () => {
        const result = adminEmbeddingFailuresQuerySchema.safeParse({
          limit: '-3',
          offset: '-10',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(1);
          expect(result.data.offset).toBe(0);
        }
      });
    });
  });

  describe('Work Note Schemas', () => {
    describe('createWorkNoteSchema', () => {
      it('should validate valid work note creation with parsed values', () => {
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

      it.each([
        ['missing required fields', {}, false],
        ['empty title', { title: '', contentRaw: 'Content' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(createWorkNoteSchema.safeParse(input).success).toBe(expected);
      });

      it('should accept relatedMeetingIds in create and update payloads', () => {
        const createResult = createWorkNoteSchema.safeParse({
          title: '회의 연계 업무',
          contentRaw: '회의 내용 기반 업무 정리',
          relatedMeetingIds: ['MEET-001', 'MEET-002'],
        });
        expect(createResult.success).toBe(true);
        if (createResult.success) {
          expect(createResult.data.relatedMeetingIds).toEqual(['MEET-001', 'MEET-002']);
        }

        const updateResult = updateWorkNoteSchema.safeParse({
          relatedMeetingIds: ['MEET-003'],
        });
        expect(updateResult.success).toBe(true);
        if (updateResult.success) {
          expect(updateResult.data.relatedMeetingIds).toEqual(['MEET-003']);
        }
      });
    });

    describe('updateWorkNoteSchema', () => {
      it.each([
        ['partial title update', { title: 'Updated Title' }, true],
        ['partial content update', { contentRaw: 'Updated content' }, true],
        ['empty title', { title: '' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(updateWorkNoteSchema.safeParse(input).success).toBe(expected);
      });
    });

    describe('workNotePersonSchema', () => {
      it.each([
        ['valid OWNER role', { personId: '123456', role: 'OWNER' }, true],
        ['invalid role', { personId: '123456', role: 'INVALID' }, false],
        ['personId too short', { personId: '12345', role: 'OWNER' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(workNotePersonSchema.safeParse(input).success).toBe(expected);
      });
    });

    describe('listWorkNotesQuerySchema', () => {
      it.each([
        ['empty query', {}, true],
        ['query with search term', { q: '업무 보고' }, true],
        ['invalid date format', { from: '2024-01-01', to: '2024-12-31' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(listWorkNotesQuerySchema.safeParse(input).success).toBe(expected);
      });
    });
  });

  describe('Person Schemas', () => {
    describe('createPersonSchema', () => {
      it.each([
        ['valid person', { personId: '123456', name: '홍길동', currentDept: '개발팀' }, true],
        ['missing name', { personId: '123456' }, false],
        [
          'invalid personId format',
          { personId: 'P-0001', name: 'Test', currentDept: 'Dept' },
          false,
        ],
      ])('%s', (_desc, input, expected) => {
        expect(createPersonSchema.safeParse(input).success).toBe(expected);
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
      it.each([
        ['valid department', { deptName: '개발팀' }, true],
        ['missing deptName', {}, false],
        ['empty deptName', { deptName: '' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(createDepartmentSchema.safeParse(input).success).toBe(expected);
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

  describe('Todo Schemas', () => {
    describe('createTodoSchema', () => {
      it('should allow description up to 2000 characters', () => {
        const validData = {
          title: '할일',
          description: `${'가A!'.repeat(666)}가A`,
        };

        const result = createTodoSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject description over 2000 characters', () => {
        const invalidData = {
          title: '할일',
          description: '가'.repeat(2001),
        };

        const result = createTodoSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('updateTodoSchema', () => {
      it('should allow description up to 2000 characters', () => {
        const validData = {
          description: `${'가A!'.repeat(666)}가A`,
        };

        const result = updateTodoSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('AI Draft Schemas', () => {
    describe('enhanceWorkNoteRequestSchema', () => {
      it('should validate valid enhance request with parsed values', () => {
        const validData = {
          newContent: '추가 내용입니다.',
          generateNewTodos: true,
        };

        const result = enhanceWorkNoteRequestSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.newContent).toBe('추가 내용입니다.');
          expect(result.data.generateNewTodos).toBe(true);
        }
      });

      it.each([
        ['missing newContent', {}, false],
        ['empty newContent', { newContent: '' }, false],
      ])('%s', (_desc, input, expected) => {
        expect(enhanceWorkNoteRequestSchema.safeParse(input).success).toBe(expected);
      });

      it('should default generateNewTodos to true', () => {
        const validData = {
          newContent: '내용',
        };

        const result = enhanceWorkNoteRequestSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.generateNewTodos).toBe(true);
        }
      });
    });
  });

  describe('Search Schemas', () => {
    describe('searchWorkNotesSchema', () => {
      it('should validate basic search query with defaults', () => {
        const result = searchWorkNotesSchema.safeParse({ query: '업무 보고서' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(10);
        }
      });

      it.each([
        ['missing query', {}, false],
        ['empty query', { query: '' }, false],
        ['limit over 100', { query: 'test', limit: 150 }, false],
      ])('%s', (_desc, input, expected) => {
        expect(searchWorkNotesSchema.safeParse(input).success).toBe(expected);
      });
    });

    describe('ragQuerySchema', () => {
      it('should validate basic RAG query with defaults', () => {
        const result = ragQuerySchema.safeParse({ query: '업무 관련 내용 검색' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe('GLOBAL');
          expect(result.data.topK).toBe(5);
        }
      });

      it.each([
        ['invalid scope', { query: 'test', scope: 'INVALID' }, false],
        ['topK over 20', { query: 'test', topK: 25 }, false],
      ])('%s', (_desc, input, expected) => {
        expect(ragQuerySchema.safeParse(input).success).toBe(expected);
      });
    });
  });
});
