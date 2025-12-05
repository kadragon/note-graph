// Trace: SPEC-todo-1, TASK-046
import { groupTodosByWorkNote } from '@web/pages/Dashboard/components/groupTodosByWorkNote';
import type { Todo } from '@web/types/api';
import { describe, expect, it } from 'vitest';

const sampleTodos: Todo[] = [
  {
    id: 'TODO-1',
    workNoteId: 'WORK-1',
    workTitle: '업무 A',
    title: '첫 번째',
    description: null,
    status: '진행중',
    dueDate: null,
    waitUntil: null,
    repeatRule: 'NONE',
    recurrenceType: null,
    customInterval: null,
    customUnit: null,
    skipWeekends: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'TODO-2',
    workNoteId: 'WORK-1',
    workTitle: '업무 A',
    title: '두 번째',
    description: null,
    status: '진행중',
    dueDate: null,
    waitUntil: null,
    repeatRule: 'NONE',
    recurrenceType: null,
    customInterval: null,
    customUnit: null,
    skipWeekends: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'TODO-3',
    workNoteId: 'WORK-2',
    workTitle: '업무 B',
    title: '세 번째',
    description: null,
    status: '진행중',
    dueDate: null,
    waitUntil: null,
    repeatRule: 'NONE',
    recurrenceType: null,
    customInterval: null,
    customUnit: null,
    skipWeekends: false,
    createdAt: '',
    updatedAt: '',
  },
];

describe('groupTodosByWorkNote', () => {
  it('groups todos by work note while preserving order', () => {
    const groups = groupTodosByWorkNote(sampleTodos);

    expect(groups).toHaveLength(2);
    expect(groups[0].workNoteId).toBe('WORK-1');
    expect(groups[0].todos.map((t) => t.id)).toEqual(['TODO-1', 'TODO-2']);
    expect(groups[1].workNoteId).toBe('WORK-2');
    expect(groups[1].todos.map((t) => t.id)).toEqual(['TODO-3']);
  });

  it('uses fallback group when work note is missing', () => {
    const groups = groupTodosByWorkNote([
      {
        ...sampleTodos[0],
        id: 'TODO-4',
        workNoteId: null,
        workTitle: null as unknown as string,
      },
    ]);

    expect(groups[0].workNoteId).toBeNull();
    expect(groups[0].workTitle).toBe('업무 노트 없음');
    expect(groups[0].todos[0].id).toBe('TODO-4');
  });

  it('returns groups in order they first appear in the input', () => {
    const todos: Todo[] = [
      {
        ...sampleTodos[0],
        id: 'TODO-A',
        workNoteId: 'WORK-2',
        workTitle: '업무 B',
      },
      {
        ...sampleTodos[0],
        id: 'TODO-B',
        workNoteId: 'WORK-1',
        workTitle: '업무 A',
      },
      {
        ...sampleTodos[0],
        id: 'TODO-C',
        workNoteId: 'WORK-2',
        workTitle: '업무 B',
      },
    ];

    const groups = groupTodosByWorkNote(todos);

    // Groups should appear in the order of first occurrence
    expect(groups.map((g) => g.workNoteId)).toEqual(['WORK-2', 'WORK-1']);
    expect(groups[0].todos.map((t) => t.id)).toEqual(['TODO-A', 'TODO-C']);
    expect(groups[1].todos.map((t) => t.id)).toEqual(['TODO-B']);
  });
});
