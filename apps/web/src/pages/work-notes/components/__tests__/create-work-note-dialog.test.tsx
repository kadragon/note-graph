import userEvent from '@testing-library/user-event';
import { usePersons } from '@web/hooks/use-persons';
import { useToast } from '@web/hooks/use-toast';
import { useCreateWorkNote } from '@web/hooks/use-work-notes';
import { createPerson, createTaskCategory } from '@web/test/factories';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateWorkNoteDialog } from '../create-work-note-dialog';

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
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input id={id} type="checkbox" checked={checked} onChange={() => onCheckedChange?.(!checked)} />
  ),
}));

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: ({
    selectedPersonIds,
    onSelectionChange,
    isLoading,
  }: {
    persons: Array<{ personId: string; name: string }>;
    selectedPersonIds: string[];
    onSelectionChange: (ids: string[]) => void;
    isLoading?: boolean;
  }) => (
    <div data-testid="assignee-selector">
      {isLoading ? (
        <span>담당자 로딩 중...</span>
      ) : (
        <>
          <span>Selected: {selectedPersonIds.length}</span>
          <button type="button" onClick={() => onSelectionChange(['person-1'])}>
            Select Person
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock('@web/components/category-selector', () => ({
  CategorySelector: ({
    categories,
    selectedIds,
    onSelectionChange,
    isLoading,
  }: {
    categories: Array<{ categoryId: string; name: string }>;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    isLoading?: boolean;
  }) => (
    <div data-testid="category-selector">
      {isLoading ? (
        <span>카테고리 로딩 중...</span>
      ) : (
        <>
          <span>Categories: {categories.length}</span>
          <span>Selected: {selectedIds.length}</span>
          <button type="button" onClick={() => onSelectionChange(['cat-1'])}>
            Select Category
          </button>
        </>
      )}
    </div>
  ),
}));

const mockMutateAsync = vi.fn();
const mockToast = vi.fn();

vi.mock('@web/hooks/use-work-notes', () => ({
  useCreateWorkNote: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@web/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
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

describe('CreateWorkNoteDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: 'new-work-note-id' });
    // Reset mocks to default values
    vi.mocked(useCreateWorkNote).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateWorkNote>);
    vi.mocked(usePersons).mockReturnValue({
      data: [createPerson({ personId: 'person-1', name: '홍길동' })],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });
  });

  const openContentTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: '내용' }));
  };

  describe('dialog rendering', () => {
    it('renders dialog when open is true', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('새 업무노트 작성')).toBeInTheDocument();
    });

    it('does not render dialog when open is false', () => {
      render(<CreateWorkNoteDialog {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form fields', () => {
    it('renders basic and content tabs for reduced vertical scrolling', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('tab', { name: '기본 정보' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '내용' })).toBeInTheDocument();
    });

    it('renders title input', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByLabelText('제목')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('업무노트 제목을 입력하세요')).toBeInTheDocument();
    });

    it('renders content textarea', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByPlaceholderText('업무노트 내용을 입력하세요')).toBeInTheDocument();
    });

    it('renders category selector', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByTestId('category-selector')).toBeInTheDocument();
      expect(screen.getByText('업무 구분 (선택사항)')).toBeInTheDocument();
    });

    it('renders assignee selector', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByTestId('assignee-selector')).toBeInTheDocument();
      expect(screen.getByText('담당자 (선택사항)')).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    });
  });

  describe('form interaction', () => {
    it('allows entering title', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      const titleInput = screen.getByLabelText('제목');
      await user.type(titleInput, '테스트 제목');

      expect(titleInput).toHaveValue('테스트 제목');
    });

    it('allows entering content', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await openContentTab(user);
      const contentInput = screen.getByPlaceholderText('업무노트 내용을 입력하세요');
      await user.type(contentInput, '테스트 내용');

      expect(contentInput).toHaveValue('테스트 내용');
    });

    it('allows selecting categories', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.click(screen.getByText('Select Category'));

      expect(screen.getByText('Selected: 1')).toBeInTheDocument();
    });

    it('allows selecting assignees', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.click(screen.getByText('Select Person'));

      // After clicking, the selected count should show
      const assigneeSelector = screen.getByTestId('assignee-selector');
      expect(assigneeSelector).toHaveTextContent('Selected: 1');
    });
  });

  describe('form submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<CreateWorkNoteDialog open={true} onOpenChange={onOpenChange} />);

      await user.type(screen.getByLabelText('제목'), '새 업무노트');
      await openContentTab(user);
      await user.type(
        screen.getByPlaceholderText('업무노트 내용을 입력하세요'),
        '업무노트 내용입니다.'
      );
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          title: '새 업무노트',
          content: '업무노트 내용입니다.',
          categoryIds: undefined,
          relatedPersonIds: undefined,
        });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('submits form with categories and assignees', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('제목'), '새 업무노트');
      await user.click(screen.getByText('Select Category'));
      await user.click(screen.getByText('Select Person'));
      await openContentTab(user);
      await user.type(
        screen.getByPlaceholderText('업무노트 내용을 입력하세요'),
        '업무노트 내용입니다.'
      );
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          title: '새 업무노트',
          content: '업무노트 내용입니다.',
          categoryIds: ['cat-1'],
          relatedPersonIds: ['person-1'],
        });
      });
    });

    it('trims title and content before submission', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('제목'), '  업무노트  ');
      await openContentTab(user);
      await user.type(screen.getByPlaceholderText('업무노트 내용을 입력하세요'), '  내용  ');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            title: '업무노트',
            content: '내용',
          })
        );
      });
    });
  });

  describe('validation', () => {
    it('does not submit with empty title', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await openContentTab(user);
      await user.type(
        screen.getByPlaceholderText('업무노트 내용을 입력하세요'),
        '업무노트 내용입니다.'
      );
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '오류',
        description: '제목을 입력해주세요.',
      });
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: '기본 정보' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
      );
    });

    it('does not submit with empty content', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('제목'), '새 업무노트');
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '오류',
        description: '내용을 입력해주세요.',
      });
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: '내용' })).toHaveAttribute('aria-selected', 'true')
      );
    });

    it('does not submit with whitespace-only title', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('제목'), '   ');
      await openContentTab(user);
      await user.type(
        screen.getByPlaceholderText('업무노트 내용을 입력하세요'),
        '업무노트 내용입니다.'
      );
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('does not submit with whitespace-only content', async () => {
      const user = userEvent.setup();
      render(<CreateWorkNoteDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('제목'), '새 업무노트');
      await openContentTab(user);
      await user.type(screen.getByPlaceholderText('업무노트 내용을 입력하세요'), '   ');
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows loading text when submitting', () => {
      vi.mocked(useCreateWorkNote).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      } as unknown as ReturnType<typeof useCreateWorkNote>);

      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeInTheDocument();
    });

    it('disables buttons when submitting', () => {
      vi.mocked(useCreateWorkNote).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      } as unknown as ReturnType<typeof useCreateWorkNote>);

      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    });
  });

  describe('cancel behavior', () => {
    it('calls onOpenChange with false when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<CreateWorkNoteDialog open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('empty persons state', () => {
    it('shows message when no persons available', () => {
      vi.mocked(usePersons).mockReturnValue({
        data: [],
        isLoading: false,
      } as unknown as ReturnType<typeof usePersons>);

      render(<CreateWorkNoteDialog {...defaultProps} />);

      expect(
        screen.getByText('등록된 사람이 없습니다. 먼저 사람을 추가해주세요.')
      ).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles mutation error gracefully', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      mockMutateAsync.mockRejectedValue(new Error('Server error'));

      render(<CreateWorkNoteDialog open={true} onOpenChange={onOpenChange} />);

      await user.type(screen.getByLabelText('제목'), '새 업무노트');
      await openContentTab(user);
      await user.type(
        screen.getByPlaceholderText('업무노트 내용을 입력하세요'),
        '업무노트 내용입니다.'
      );
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });

      // Dialog should NOT be closed on error
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
