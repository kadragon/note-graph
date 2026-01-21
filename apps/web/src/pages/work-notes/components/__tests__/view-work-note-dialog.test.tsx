import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useDeleteTodo, useToggleTodo } from '@web/hooks/use-todos';
import { useUpdateWorkNote } from '@web/hooks/use-work-notes';
import { createTaskCategory, createWorkNote } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewWorkNoteDialog } from '../view-work-note-dialog';

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: () => <div data-testid="assignee-selector" />,
}));

vi.mock('@web/pages/dashboard/components/edit-todo-dialog', () => ({
  EditTodoDialog: () => <div data-testid="edit-todo-dialog" />,
}));

vi.mock('@web/pages/work-notes/components/work-note-file-list', () => ({
  WorkNoteFileList: ({ workNoteCreatedAt }: { workNoteCreatedAt: string }) => (
    <div data-testid="work-note-file-list" data-created-at={workNoteCreatedAt} />
  ),
}));

vi.mock('@web/pages/work-notes/components/recurring-todo-group', () => ({
  RecurringTodoGroup: () => <div data-testid="recurring-todo-group" />,
}));

vi.mock('@web/pages/work-notes/components/todo-list-item', () => ({
  TodoListItem: () => <div data-testid="todo-list-item" />,
}));

vi.mock('@web/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: ReactNode }) => (
    <div data-testid="alert-dialog" data-open={open ? 'true' : 'false'}>
      {children}
    </div>
  ),
  AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useUpdateWorkNote: vi.fn(),
}));

vi.mock('@web/hooks/use-todos', () => ({
  useToggleTodo: vi.fn(),
  useDeleteTodo: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const { mockGetWorkNote, mockGetTodos } = vi.hoisted(() => ({
  mockGetWorkNote: vi.fn().mockResolvedValue(null),
  mockGetTodos: vi.fn().mockResolvedValue([]),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    getWorkNoteTodos: vi.fn().mockResolvedValue([]),
    getWorkNote: mockGetWorkNote,
    getTodos: mockGetTodos,
    createWorkNoteTodo: vi.fn(),
  },
}));

describe('ViewWorkNoteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    vi.mocked(useUpdateWorkNote).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateWorkNote>);

    vi.mocked(useToggleTodo).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useToggleTodo>);

    vi.mocked(useDeleteTodo).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTodo>);

    vi.mocked(usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);
  });

  it('shows selected inactive categories in edit mode', async () => {
    const activeCategory = createTaskCategory({
      categoryId: 'cat-active',
      name: '기본',
      isActive: true,
    });
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '레거시',
      isActive: false,
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [activeCategory],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const workNote = createWorkNote({
      title: '업무노트',
      content: '내용',
      categories: [inactiveCategory],
    });

    // Mock detail fetch to return the work note
    mockGetWorkNote.mockResolvedValue(workNote);

    const user = userEvent.setup();

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '수정' }));

    expect(screen.getByRole('checkbox', { name: /기본/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /레거시/ })).toBeInTheDocument();
    expect(screen.getByText('(비활성)')).toBeInTheDocument();
  });

  it('keeps inactive categories visible after unchecking', async () => {
    const activeCategory = createTaskCategory({
      categoryId: 'cat-active',
      name: '기본',
      isActive: true,
    });
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '레거시',
      isActive: false,
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [activeCategory],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const workNote = createWorkNote({
      title: '업무노트',
      content: '내용',
      categories: [inactiveCategory],
    });

    // Mock detail fetch to return the work note
    mockGetWorkNote.mockResolvedValue(workNote);

    const user = userEvent.setup();

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '수정' }));

    const inactiveCheckbox = screen.getByRole('checkbox', { name: /레거시/ });

    await user.click(inactiveCheckbox);

    expect(screen.getByRole('checkbox', { name: /레거시/ })).toBeDisabled();
    expect(screen.getByText('(비활성)')).toBeInTheDocument();
  });

  it('sets markdown color mode from system preference', () => {
    const workNote = createWorkNote({
      title: '업무노트',
      content: '마크다운 내용',
    });

    // Mock detail fetch to return the work note
    mockGetWorkNote.mockResolvedValue(workNote);

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    const markdownText = screen.getByText('마크다운 내용');
    const markdownContainer = markdownText.closest('div');

    expect(markdownContainer).toHaveAttribute('data-color-mode', 'light');
  });

  it('uses placeholderData from list cache to show work note immediately', async () => {
    const workNote = createWorkNote({
      id: 'work-1',
      title: '캐시된 업무노트',
      content: '내용입니다',
      relatedWorkNotes: [],
    });

    const detailedWorkNote = createWorkNote({
      id: 'work-1',
      title: '캐시된 업무노트',
      content: '내용입니다',
      relatedWorkNotes: [{ relatedWorkId: 'ref-1', relatedWorkTitle: '참조 노트' }],
    });

    // Mock detail fetch to return work note with references after delay
    mockGetWorkNote.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(detailedWorkNote), 100);
        })
    );

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    // Title should be visible immediately (from placeholderData/prop)
    expect(screen.getByText('캐시된 업무노트')).toBeInTheDocument();

    // Initially shows no references (from list data)
    expect(screen.getByText('저장된 참고 업무노트가 없습니다.')).toBeInTheDocument();

    // Wait for detail fetch to complete
    await screen.findByText('참조 노트', {}, { timeout: 200 });

    // After detail fetch, references should be shown
    expect(screen.getByText('참조 노트')).toBeInTheDocument();
  });

  it('does not refetch detail when reopening dialog within stale window', async () => {
    const workNote = createWorkNote({
      id: 'work-2',
      title: '재사용 테스트',
      content: '내용',
      relatedWorkNotes: [],
    });

    const detailedWorkNote = createWorkNote({
      id: 'work-2',
      title: '재사용 테스트',
      content: '내용',
      relatedWorkNotes: [{ relatedWorkId: 'ref-1', relatedWorkTitle: '캐시된 참조' }],
    });

    mockGetWorkNote.mockResolvedValue(detailedWorkNote);

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={onOpenChange} />
    );

    // Wait for initial fetch
    await screen.findByText('캐시된 참조');
    expect(mockGetWorkNote).toHaveBeenCalledTimes(1);

    // Close dialog
    rerender(<ViewWorkNoteDialog workNote={workNote} open={false} onOpenChange={onOpenChange} />);

    // Reopen dialog
    rerender(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={onOpenChange} />);

    // Should use cached data, not refetch
    await screen.findByText('캐시된 참조');
    expect(mockGetWorkNote).toHaveBeenCalledTimes(1); // Still 1, not 2
  });

  it('renders markdown content through lazy-loaded component', async () => {
    const workNote = createWorkNote({
      title: '마크다운 테스트',
      content: '**굵은 텍스트**와 _기울임_ 테스트',
    });

    mockGetWorkNote.mockResolvedValue(workNote);

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    // Verify the markdown container has the lazy-markdown wrapper
    await waitFor(() => {
      const markdownContainer = screen.getByTestId('lazy-markdown');
      expect(markdownContainer).toBeInTheDocument();
    });

    // Verify the markdown content renders correctly
    expect(screen.getByText(/굵은 텍스트/)).toBeInTheDocument();
  });
});
