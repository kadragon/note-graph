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
  WorkNoteFileList: () => <div data-testid="work-note-file-list" />,
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

vi.mock('@web/lib/api', () => ({
  API: {
    getWorkNoteTodos: vi.fn().mockResolvedValue([]),
    getWorkNote: vi.fn().mockResolvedValue(null),
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

    render(<ViewWorkNoteDialog workNote={workNote} open={true} onOpenChange={vi.fn()} />);

    const markdownText = screen.getByText('마크다운 내용');
    const markdownContainer = markdownText.closest('div');

    expect(markdownContainer).toHaveAttribute('data-color-mode', 'light');
  });
});
