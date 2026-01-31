import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTodoForm } from '../use-todo-form';

describe('useTodoForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useTodoForm());

    expect(result.current.values.title).toBe('');
    expect(result.current.values.description).toBe('');
    expect(result.current.values.dueDate).toBe('2026-02-01');
    expect(result.current.values.waitUntil).toBe('');
    expect(result.current.values.repeatRule).toBe('NONE');
    expect(result.current.values.recurrenceType).toBe('DUE_DATE');
    expect(result.current.values.customInterval).toBe(1);
    expect(result.current.values.customUnit).toBe('MONTH');
    expect(result.current.values.skipWeekends).toBe(false);
  });

  it('initializes with provided initial values', () => {
    const { result } = renderHook(() =>
      useTodoForm({
        title: '기존 할일',
        description: '설명',
        dueDate: '2026-03-15',
        repeatRule: 'WEEKLY',
      })
    );

    expect(result.current.values.title).toBe('기존 할일');
    expect(result.current.values.description).toBe('설명');
    expect(result.current.values.dueDate).toBe('2026-03-15');
    expect(result.current.values.repeatRule).toBe('WEEKLY');
  });

  it('updates individual field values', () => {
    const { result } = renderHook(() => useTodoForm());

    act(() => {
      result.current.setField('title', '새 할일');
    });

    expect(result.current.values.title).toBe('새 할일');
  });

  it('auto-fills dueDate when waitUntil is set and dueDate is empty', () => {
    const { result } = renderHook(() => useTodoForm({ dueDate: '' }));

    act(() => {
      result.current.setField('waitUntil', '2026-02-15');
    });

    expect(result.current.values.waitUntil).toBe('2026-02-15');
    expect(result.current.values.dueDate).toBe('2026-02-15');
  });

  it('does not auto-fill dueDate when it already has a value', () => {
    const { result } = renderHook(() => useTodoForm({ dueDate: '2026-02-10' }));

    act(() => {
      result.current.setField('waitUntil', '2026-02-15');
    });

    expect(result.current.values.waitUntil).toBe('2026-02-15');
    expect(result.current.values.dueDate).toBe('2026-02-10');
  });

  it('returns isValid as false when title is empty', () => {
    const { result } = renderHook(() => useTodoForm());

    expect(result.current.isValid).toBe(false);
  });

  it('returns isValid as true when title has content', () => {
    const { result } = renderHook(() => useTodoForm({ title: '할일' }));

    expect(result.current.isValid).toBe(true);
  });

  it('builds correct CreateTodoRequest data', () => {
    const { result } = renderHook(() =>
      useTodoForm({
        title: '테스트 할일',
        description: '설명',
        dueDate: '2026-02-15',
        waitUntil: '2026-02-10',
        repeatRule: 'CUSTOM',
        customInterval: 2,
        customUnit: 'WEEK',
        skipWeekends: true,
      })
    );

    const data = result.current.getData();

    expect(data.title).toBe('테스트 할일');
    expect(data.description).toBe('설명');
    expect(data.dueDate).toBe('2026-02-15');
    expect(data.waitUntil).toBe('2026-02-10');
    expect(data.repeatRule).toBe('CUSTOM');
    expect(data.customInterval).toBe(2);
    expect(data.customUnit).toBe('WEEK');
    expect(data.skipWeekends).toBe(true);
  });

  it('excludes customInterval and customUnit when repeatRule is not CUSTOM', () => {
    const { result } = renderHook(() =>
      useTodoForm({
        title: '할일',
        repeatRule: 'DAILY',
        customInterval: 5,
        customUnit: 'WEEK',
      })
    );

    const data = result.current.getData();

    expect(data.customInterval).toBeUndefined();
    expect(data.customUnit).toBeUndefined();
  });

  it('resets form to initial values', () => {
    const { result } = renderHook(() => useTodoForm());

    act(() => {
      result.current.setField('title', '변경된 제목');
      result.current.setField('description', '변경된 설명');
    });

    expect(result.current.values.title).toBe('변경된 제목');

    act(() => {
      result.current.reset();
    });

    expect(result.current.values.title).toBe('');
    expect(result.current.values.description).toBe('');
    expect(result.current.values.dueDate).toBe('2026-02-01');
  });

  it('trims title and description in getData', () => {
    const { result } = renderHook(() =>
      useTodoForm({
        title: '  공백 포함  ',
        description: '  설명  ',
      })
    );

    const data = result.current.getData();

    expect(data.title).toBe('공백 포함');
    expect(data.description).toBe('설명');
  });

  it('returns undefined for empty description', () => {
    const { result } = renderHook(() =>
      useTodoForm({
        title: '할일',
        description: '   ',
      })
    );

    const data = result.current.getData();

    expect(data.description).toBeUndefined();
  });
});
