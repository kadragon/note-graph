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
      it('should validate valid enhance request', () => {
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

      it('should require newContent', () => {
        const invalidData = {};

        const result = enhanceWorkNoteRequestSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty newContent', () => {
        const invalidData = {
          newContent: '',
        };

        const result = enhanceWorkNoteRequestSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
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
