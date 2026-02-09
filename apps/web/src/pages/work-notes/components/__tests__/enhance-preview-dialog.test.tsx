import userEvent from '@testing-library/user-event';
import { useEnhanceWorkNoteForm } from '@web/hooks/use-enhance-work-note';
import { createPerson, createTaskCategory } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnhancePreviewDialog } from '../enhance-preview-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: () => <div data-testid="assignee-selector" />,
}));

vi.mock('@web/components/ai-reference-list', () => ({
  AIReferenceList: ({
    selectedIds,
    onSelectionChange,
  }: {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="ai-reference-list" data-selected-ids={selectedIds.join(',')}>
      <button type="button" onClick={() => onSelectionChange(['ref-1'])}>
        change-ai-selection
      </button>
    </div>
  ),
}));

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(() => ({
    data: [createTaskCategory({ categoryId: 'cat-1', name: '기본' })],
    isLoading: false,
  })),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(() => ({
    data: [createPerson({ personId: 'person-1', name: '홍길동' })],
    isLoading: false,
  })),
}));

const mockHandleSubmit = vi.fn((e: React.FormEvent) => {
  e.preventDefault();
  return Promise.resolve();
});

vi.mock('@web/hooks/use-enhance-work-note', () => ({
  useEnhanceWorkNoteForm: vi.fn(() => ({
    state: {
      title: '',
      content: '',
      selectedCategoryIds: [],
      selectedPersonIds: [],
      baseRelatedWorkIds: [],
      references: [],
      selectedReferenceIds: [],
      suggestedNewTodos: [],
      selectedNewTodoIds: [],
      existingTodos: [],
      isSubmitting: false,
    },
    actions: {
      setTitle: vi.fn(),
      setContent: vi.fn(),
      setSelectedCategoryIds: vi.fn(),
      setSelectedPersonIds: vi.fn(),
      setSelectedReferenceIds: vi.fn(),
      handleCategoryToggle: vi.fn(),
      toggleNewTodo: vi.fn(),
      handleSubmit: mockHandleSubmit,
      resetForm: vi.fn(),
      populateFromEnhanceResponse: vi.fn(),
    },
    data: {
      taskCategories: [createTaskCategory({ categoryId: 'cat-1', name: '기본' })],
      persons: [createPerson({ personId: 'person-1', name: '홍길동' })],
      categoriesLoading: false,
      personsLoading: false,
    },
  })),
}));

describe('EnhancePreviewDialog', () => {
  const defaultEnhanceResponse = {
    enhancedDraft: {
      title: '향상된 제목',
      content: '향상된 내용',
      category: '기본',
      todos: [],
    },
    originalContent: '원본 내용',
    existingTodos: [],
    references: [],
  };

  const defaultProps = {
    workId: 'work-1',
    open: true,
    onOpenChange: vi.fn(),
    enhanceResponse: defaultEnhanceResponse,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dialog rendering', () => {
    it('renders dialog when open is true', () => {
      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('AI 업데이트 미리보기')).toBeInTheDocument();
    });

    it('does not render dialog when open is false', () => {
      render(<EnhancePreviewDialog {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form fields', () => {
    it('renders title input', () => {
      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByLabelText('제목')).toBeInTheDocument();
    });

    it('renders content textarea', () => {
      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByLabelText('내용')).toBeInTheDocument();
    });

    it('renders apply and cancel buttons', () => {
      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '적용' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    });
  });

  describe('existing todos display', () => {
    it('shows existing todos section when there are existing todos', () => {
      vi.mocked(useEnhanceWorkNoteForm).mockReturnValue({
        state: {
          title: '제목',
          content: '내용',
          selectedCategoryIds: [],
          selectedPersonIds: [],
          suggestedNewTodos: [],
          selectedNewTodoIds: [],
          existingTodos: [
            {
              todoId: 'todo-1',
              title: '기존 할일',
              description: null,
              status: 'PENDING',
              dueDate: null,
            },
          ],
          isSubmitting: false,
        },
        actions: {
          setTitle: vi.fn(),
          setContent: vi.fn(),
          setSelectedCategoryIds: vi.fn(),
          setSelectedPersonIds: vi.fn(),
          handleCategoryToggle: vi.fn(),
          toggleNewTodo: vi.fn(),
          handleSubmit: mockHandleSubmit,
          resetForm: vi.fn(),
          populateFromEnhanceResponse: vi.fn(),
        },
        data: {
          taskCategories: [],
          persons: [],
          categoriesLoading: false,
          personsLoading: false,
        },
      } as unknown as ReturnType<typeof useEnhanceWorkNoteForm>);

      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByText('기존 할일 (유지됨)')).toBeInTheDocument();
      expect(screen.getByText('기존 할일')).toBeInTheDocument();
    });
  });

  describe('new todos selection', () => {
    it('shows new todos with checkboxes', () => {
      vi.mocked(useEnhanceWorkNoteForm).mockReturnValue({
        state: {
          title: '제목',
          content: '내용',
          selectedCategoryIds: [],
          selectedPersonIds: [],
          suggestedNewTodos: [
            { uiId: 'new-1', title: '새 할일', description: '설명', dueDate: '2024-02-01' },
          ],
          selectedNewTodoIds: ['new-1'],
          existingTodos: [],
          isSubmitting: false,
        },
        actions: {
          setTitle: vi.fn(),
          setContent: vi.fn(),
          setSelectedCategoryIds: vi.fn(),
          setSelectedPersonIds: vi.fn(),
          handleCategoryToggle: vi.fn(),
          toggleNewTodo: vi.fn(),
          handleSubmit: mockHandleSubmit,
          resetForm: vi.fn(),
          populateFromEnhanceResponse: vi.fn(),
        },
        data: {
          taskCategories: [],
          persons: [],
          categoriesLoading: false,
          personsLoading: false,
        },
      } as unknown as ReturnType<typeof useEnhanceWorkNoteForm>);

      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByText('추가될 할일 (선택)')).toBeInTheDocument();
      expect(screen.getByText('새 할일')).toBeInTheDocument();
    });

    it('allows toggling new todo selection', async () => {
      const mockToggle = vi.fn();
      vi.mocked(useEnhanceWorkNoteForm).mockReturnValue({
        state: {
          title: '제목',
          content: '내용',
          selectedCategoryIds: [],
          selectedPersonIds: [],
          suggestedNewTodos: [
            { uiId: 'new-1', title: '새 할일', description: '', dueDate: '2024-02-01' },
          ],
          selectedNewTodoIds: ['new-1'],
          existingTodos: [],
          isSubmitting: false,
        },
        actions: {
          setTitle: vi.fn(),
          setContent: vi.fn(),
          setSelectedCategoryIds: vi.fn(),
          setSelectedPersonIds: vi.fn(),
          handleCategoryToggle: vi.fn(),
          toggleNewTodo: mockToggle,
          handleSubmit: mockHandleSubmit,
          resetForm: vi.fn(),
          populateFromEnhanceResponse: vi.fn(),
        },
        data: {
          taskCategories: [],
          persons: [],
          categoriesLoading: false,
          personsLoading: false,
        },
      } as unknown as ReturnType<typeof useEnhanceWorkNoteForm>);

      const user = userEvent.setup();
      render(<EnhancePreviewDialog {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(mockToggle).toHaveBeenCalledWith('new-1');
    });
  });

  describe('form submission', () => {
    it('calls handleSubmit on apply button click', async () => {
      const user = userEvent.setup();
      render(<EnhancePreviewDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: '적용' }));

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it('shows loading state when submitting', () => {
      vi.mocked(useEnhanceWorkNoteForm).mockReturnValue({
        state: {
          title: '제목',
          content: '내용',
          selectedCategoryIds: [],
          selectedPersonIds: [],
          suggestedNewTodos: [],
          selectedNewTodoIds: [],
          existingTodos: [],
          isSubmitting: true,
        },
        actions: {
          setTitle: vi.fn(),
          setContent: vi.fn(),
          setSelectedCategoryIds: vi.fn(),
          setSelectedPersonIds: vi.fn(),
          handleCategoryToggle: vi.fn(),
          toggleNewTodo: vi.fn(),
          handleSubmit: mockHandleSubmit,
          resetForm: vi.fn(),
          populateFromEnhanceResponse: vi.fn(),
        },
        data: {
          taskCategories: [],
          persons: [],
          categoriesLoading: false,
          personsLoading: false,
        },
      } as unknown as ReturnType<typeof useEnhanceWorkNoteForm>);

      render(<EnhancePreviewDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '적용 중...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '적용 중...' })).toBeDisabled();
    });
  });

  it('controls AIReferenceList by form selectedReferenceIds and forwards selection changes', async () => {
    const mockSetSelectedReferenceIds = vi.fn();
    const user = userEvent.setup();

    vi.mocked(useEnhanceWorkNoteForm).mockReturnValue({
      state: {
        title: '제목',
        content: '내용',
        selectedCategoryIds: [],
        selectedPersonIds: [],
        baseRelatedWorkIds: ['base-1'],
        references: [
          { workId: 'ref-1', title: '참고 1', content: '내용 1', similarityScore: 0.9 },
          { workId: 'ref-2', title: '참고 2', content: '내용 2', similarityScore: 0.8 },
        ],
        selectedReferenceIds: ['ref-2'],
        suggestedNewTodos: [],
        selectedNewTodoIds: [],
        existingTodos: [],
        isSubmitting: false,
      },
      actions: {
        setTitle: vi.fn(),
        setContent: vi.fn(),
        setSelectedCategoryIds: vi.fn(),
        setSelectedPersonIds: vi.fn(),
        setSelectedReferenceIds: mockSetSelectedReferenceIds,
        handleCategoryToggle: vi.fn(),
        toggleNewTodo: vi.fn(),
        handleSubmit: mockHandleSubmit,
        resetForm: vi.fn(),
        populateFromEnhanceResponse: vi.fn(),
      },
      data: {
        taskCategories: [],
        persons: [],
        categoriesLoading: false,
        personsLoading: false,
      },
    } as unknown as ReturnType<typeof useEnhanceWorkNoteForm>);

    render(
      <EnhancePreviewDialog
        {...defaultProps}
        enhanceResponse={{
          ...defaultEnhanceResponse,
          references: [
            { workId: 'ref-1', title: '참고 1', content: '내용 1', similarityScore: 0.9 },
            { workId: 'ref-2', title: '참고 2', content: '내용 2', similarityScore: 0.8 },
          ],
        }}
      />
    );

    expect(screen.getByTestId('ai-reference-list')).toHaveAttribute('data-selected-ids', 'ref-2');

    await user.click(screen.getByRole('button', { name: 'change-ai-selection' }));

    expect(mockSetSelectedReferenceIds).toHaveBeenCalledWith(['ref-1']);
  });
});
