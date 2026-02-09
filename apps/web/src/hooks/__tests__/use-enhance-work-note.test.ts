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
    updateWorkNote: vi.fn(),
    createWorkNoteTodo: vi.fn(),
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

    vi.mocked(API.updateWorkNote).mockResolvedValue({} as never);
    vi.mocked(API.createWorkNoteTodo).mockResolvedValue({} as never);

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

  it('stores AI references and initializes all as selected', () => {
    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    const references = [
      {
        workId: 'ref-1',
        title: '참고 노트 1',
        content: '내용 1',
        similarityScore: 0.9,
      },
      {
        workId: 'ref-2',
        title: '참고 노트 2',
        content: '내용 2',
        similarityScore: 0.8,
      },
    ];

    act(() => {
      result.current.actions.populateFromEnhanceResponse({
        enhancedDraft: {
          title: '제목',
          content: '내용',
          category: '',
          todos: [],
        },
        originalContent: '원본 내용',
        existingTodos: [],
        references,
      });
    });

    expect(result.current.state.references).toEqual(references);
    expect(result.current.state.selectedReferenceIds).toEqual(['ref-1', 'ref-2']);
  });

  it('updates selectedReferenceIds and keeps unchecked references excluded', () => {
    const { result } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));

    act(() => {
      result.current.actions.populateFromEnhanceResponse({
        enhancedDraft: {
          title: '제목',
          content: '내용',
          category: '',
          todos: [],
        },
        originalContent: '원본 내용',
        existingTodos: [],
        references: [
          { workId: 'ref-1', title: '참고 1', content: '내용 1', similarityScore: 0.9 },
          { workId: 'ref-2', title: '참고 2', content: '내용 2', similarityScore: 0.8 },
          { workId: 'ref-3', title: '참고 3', content: '내용 3', similarityScore: 0.7 },
        ],
      });
    });

    const actions = result.current.actions as unknown as {
      setSelectedReferenceIds: (ids: string[]) => void;
    };

    act(() => {
      actions.setSelectedReferenceIds(['ref-1', 'ref-3']);
    });

    expect(result.current.state.selectedReferenceIds).toEqual(['ref-1', 'ref-3']);
    expect(result.current.state.selectedReferenceIds).not.toContain('ref-2');

    act(() => {
      result.current.actions.setTitle('수정된 제목');
    });

    expect(result.current.state.selectedReferenceIds).toEqual(['ref-1', 'ref-3']);
    expect(result.current.state.selectedReferenceIds).not.toContain('ref-2');
  });

  it('submits relatedWorkIds as base + selected references and excludes unchecked references', async () => {
    const { result } = renderHookWithClient(() =>
      useEnhanceWorkNoteForm('work-1', {
        existingRelatedWorkIds: ['base-keep', 'ref-2'],
      } as unknown as Parameters<typeof useEnhanceWorkNoteForm>[1])
    );

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
        references: [
          { workId: 'ref-1', title: '참고 1', content: '내용 1', similarityScore: 0.9 },
          { workId: 'ref-2', title: '참고 2', content: '내용 2', similarityScore: 0.8 },
        ],
      });
    });

    act(() => {
      result.current.actions.setSelectedReferenceIds(['ref-1']);
    });

    await act(async () => {
      await result.current.actions.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(API.updateWorkNote).toHaveBeenCalledWith(
      'work-1',
      expect.objectContaining({
        relatedWorkIds: ['base-keep', 'ref-1'],
      })
    );
  });

  it('does not update relatedWorkIds when existing related works are not loaded', async () => {
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
        references: [
          { workId: 'ref-1', title: '참고 1', content: '내용 1', similarityScore: 0.9 },
          { workId: 'ref-2', title: '참고 2', content: '내용 2', similarityScore: 0.8 },
        ],
      });
    });

    act(() => {
      result.current.actions.setSelectedReferenceIds(['ref-1']);
    });

    await act(async () => {
      await result.current.actions.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    const updatePayload = vi.mocked(API.updateWorkNote).mock.calls.at(-1)?.[1] as
      | { relatedWorkIds?: string[] }
      | undefined;
    expect(updatePayload?.relatedWorkIds).toBeUndefined();
  });

  it('invalidates detail/todo queries on submit and does not use stale work-note key', async () => {
    const { result, queryClient } = renderHookWithClient(() => useEnhanceWorkNoteForm('work-1'));
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

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

    await act(async () => {
      await result.current.actions.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['work-note-detail', 'work-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['work-note-todos', 'work-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['todos'],
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ['work-note', 'work-1'],
    });
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
