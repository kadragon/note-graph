import { act, waitFor } from '@testing-library/react';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { API } from '@web/lib/api';
import { createTaskCategory } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEnhanceWorkNote, useEnhanceWorkNoteForm } from '../use-enhance-work-note';

vi.mock('@web/lib/api', () => ({
  API: {
    enhanceWorkNote: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useEnhanceWorkNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls API.enhanceWorkNote with correct parameters', async () => {
    const mockResponse = {
      enhancedDraft: {
        title: '향상된 제목',
        content: '향상된 내용',
        category: '업무',
        todos: [],
      },
      originalContent: '원본 내용',
      existingTodos: [],
      references: [],
    };
    vi.mocked(API.enhanceWorkNote).mockResolvedValue(mockResponse);

    const { result } = renderHookWithClient(() => useEnhanceWorkNote());

    await act(async () => {
      result.current.mutate({
        workId: 'work-1',
        newContent: '새로운 정보',
        generateNewTodos: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.enhanceWorkNote).toHaveBeenCalledWith('work-1', {
      newContent: '새로운 정보',
      generateNewTodos: true,
    });
    expect(result.current.data).toEqual(mockResponse);
  });

  it('passes file to API when provided', async () => {
    const mockResponse = {
      enhancedDraft: {
        title: '향상된 제목',
        content: '향상된 내용',
        category: '업무',
        todos: [],
      },
      originalContent: '원본 내용',
      existingTodos: [],
      references: [],
    };
    vi.mocked(API.enhanceWorkNote).mockResolvedValue(mockResponse);

    const { result } = renderHookWithClient(() => useEnhanceWorkNote());

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({
        workId: 'work-1',
        newContent: '추가 정보',
        file,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.enhanceWorkNote).toHaveBeenCalledWith('work-1', {
      newContent: '추가 정보',
      file,
    });
  });

  it('shows error toast when enhancement fails', async () => {
    vi.mocked(API.enhanceWorkNote).mockRejectedValue(new Error('Enhancement failed'));

    const { result } = renderHookWithClient(() => useEnhanceWorkNote());

    await act(async () => {
      result.current.mutate({
        workId: 'work-1',
        newContent: '실패 테스트',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Enhancement failed',
    });
  });
});

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

describe('useEnhanceWorkNoteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
  });

  it('initializes with empty state', () => {
    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    expect(result.current.state.title).toBe('');
    expect(result.current.state.content).toBe('');
    expect(result.current.state.selectedCategoryIds).toEqual([]);
    expect(result.current.state.selectedNewTodoIds).toEqual([]);
    expect(result.current.state.existingTodos).toEqual([]);
  });

  it('populates state from enhance response', () => {
    const activeCategory = createTaskCategory({
      categoryId: 'cat-1',
      name: '업무',
      isActive: true,
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [activeCategory],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    act(() => {
      result.current.actions.populateFromEnhanceResponse({
        enhancedDraft: {
          title: '향상된 제목',
          content: '향상된 내용',
          category: '업무',
          todos: [{ title: '새 할일', description: '설명', dueDate: '2024-02-01' }],
        },
        originalContent: '원본 내용',
        existingTodos: [
          {
            todoId: 'todo-1',
            title: '기존 할일',
            description: null,
            status: 'PENDING',
            dueDate: '2024-01-15',
          },
        ],
        references: [],
      });
    });

    expect(result.current.state.title).toBe('향상된 제목');
    expect(result.current.state.content).toBe('향상된 내용');
    expect(result.current.state.suggestedNewTodos).toHaveLength(1);
    expect(result.current.state.existingTodos).toHaveLength(1);
    expect(result.current.state.existingTodos[0].title).toBe('기존 할일');
  });

  it('toggles suggested todo selection', () => {
    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    act(() => {
      result.current.actions.populateFromEnhanceResponse({
        enhancedDraft: {
          title: '제목',
          content: '내용',
          category: '',
          todos: [
            { title: '할일 1', description: '', dueDate: '2024-02-01' },
            { title: '할일 2', description: '', dueDate: '2024-02-02' },
          ],
        },
        originalContent: '',
        existingTodos: [],
        references: [],
      });
    });

    const todoId = result.current.state.suggestedNewTodos[0].uiId;

    // Initially all todos are selected
    expect(result.current.state.selectedNewTodoIds).toHaveLength(2);

    // Toggle off
    act(() => {
      result.current.actions.toggleNewTodo(todoId);
    });
    expect(result.current.state.selectedNewTodoIds).toHaveLength(1);
    expect(result.current.state.selectedNewTodoIds).not.toContain(todoId);

    // Toggle back on
    act(() => {
      result.current.actions.toggleNewTodo(todoId);
    });
    expect(result.current.state.selectedNewTodoIds).toContain(todoId);
  });

  it('resets form state', () => {
    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    act(() => {
      result.current.actions.populateFromEnhanceResponse({
        enhancedDraft: {
          title: '제목',
          content: '내용',
          category: '',
          todos: [],
        },
        originalContent: '',
        existingTodos: [],
        references: [],
      });
    });

    expect(result.current.state.title).toBe('제목');

    act(() => {
      result.current.actions.resetForm();
    });

    expect(result.current.state.title).toBe('');
    expect(result.current.state.content).toBe('');
  });
});
