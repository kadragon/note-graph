// Trace: Phase 5.1 - Consolidate Mappers
// Tests for transforming backend todo format to frontend format

import { describe, expect, it } from 'vitest';
import type { BackendTodo } from './todo';
import { transformTodoFromBackend } from './todo';

describe('transformTodoFromBackend', () => {
  it('transforms backend todo to frontend format', () => {
    const backend: BackendTodo = {
      todoId: 'todo-123',
      workId: 'work-456',
      title: '할일 제목',
      status: '진행중',
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T12:00:00Z',
    };

    const result = transformTodoFromBackend(backend);

    expect(result).toEqual({
      id: 'todo-123',
      workNoteId: 'work-456',
      workTitle: undefined,
      workCategory: undefined,
      title: '할일 제목',
      description: undefined,
      status: '진행중',
      dueDate: undefined,
      waitUntil: undefined,
      repeatRule: undefined,
      recurrenceType: undefined,
      customInterval: undefined,
      customUnit: undefined,
      skipWeekends: undefined,
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T12:00:00Z',
    });
  });

  it('preserves optional fields when provided', () => {
    const backend: BackendTodo = {
      todoId: 'todo-789',
      workId: 'work-111',
      title: '반복 할일',
      description: '상세 설명입니다.',
      status: '완료',
      dueDate: '2026-02-15',
      waitUntil: '2026-02-01',
      repeatRule: 'WEEKLY',
      recurrenceType: 'DUE_DATE',
      customInterval: 2,
      customUnit: 'WEEK',
      skipWeekends: true,
      workTitle: '업무 제목',
      workCategory: '기획',
      createdAt: '2026-01-31T10:00:00Z',
      updatedAt: '2026-01-31T12:00:00Z',
    };

    const result = transformTodoFromBackend(backend);

    expect(result.id).toBe('todo-789');
    expect(result.workNoteId).toBe('work-111');
    expect(result.description).toBe('상세 설명입니다.');
    expect(result.dueDate).toBe('2026-02-15');
    expect(result.waitUntil).toBe('2026-02-01');
    expect(result.repeatRule).toBe('WEEKLY');
    expect(result.recurrenceType).toBe('DUE_DATE');
    expect(result.customInterval).toBe(2);
    expect(result.customUnit).toBe('WEEK');
    expect(result.skipWeekends).toBe(true);
    expect(result.workTitle).toBe('업무 제목');
    expect(result.workCategory).toBe('기획');
  });

  it('maps all status values correctly', () => {
    const statuses = ['진행중', '완료', '보류', '중단'] as const;

    for (const status of statuses) {
      const backend: BackendTodo = {
        todoId: 'todo-1',
        workId: 'work-1',
        title: '테스트',
        status,
        createdAt: '2026-01-31T10:00:00Z',
        updatedAt: '2026-01-31T10:00:00Z',
      };

      const result = transformTodoFromBackend(backend);
      expect(result.status).toBe(status);
    }
  });
});
