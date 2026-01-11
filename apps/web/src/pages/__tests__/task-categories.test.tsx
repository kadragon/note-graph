import userEvent from '@testing-library/user-event';
import {
  useDeleteTaskCategory,
  useTaskCategories,
  useToggleTaskCategoryActive,
} from '@web/hooks/use-task-categories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskCategories from '../task-categories/task-categories';

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
  useDeleteTaskCategory: vi.fn(),
  useToggleTaskCategoryActive: vi.fn(),
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

vi.mock('../task-categories/components/create-task-category-dialog', () => ({
  CreateTaskCategoryDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-task-category-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../task-categories/components/edit-task-category-dialog', () => ({
  EditTaskCategoryDialog: ({ open, category }: { open: boolean; category: unknown }) => (
    <div
      data-testid="edit-task-category-dialog"
      data-open={open ? 'true' : 'false'}
      data-category={category ? 'selected' : 'none'}
    />
  ),
}));

describe('task-categories page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useToggleTaskCategoryActive).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useToggleTaskCategoryActive>);
  });

  it('shows empty state when there are no categories', () => {
    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
    vi.mocked(useDeleteTaskCategory).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteTaskCategory>);

    render(<TaskCategories />);

    expect(screen.getByText('등록된 업무 구분이 없습니다.')).toBeInTheDocument();
  });

  it('opens the create dialog when clicking the add button', async () => {
    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
    vi.mocked(useDeleteTaskCategory).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteTaskCategory>);

    const user = userEvent.setup();
    render(<TaskCategories />);

    expect(screen.getByTestId('create-task-category-dialog')).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button', { name: '새 업무 구분' }));

    expect(screen.getByTestId('create-task-category-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('opens the edit dialog for the selected category', async () => {
    vi.mocked(useTaskCategories).mockReturnValue({
      data: [
        {
          categoryId: 'CATEGORY-1',
          name: '일반',
          isActive: true,
          createdAt: '2025-01-01T09:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
    vi.mocked(useDeleteTaskCategory).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteTaskCategory>);

    const user = userEvent.setup();
    render(<TaskCategories />);

    const row = screen.getByText('일반').closest('tr');
    expect(row).not.toBeNull();

    const actionButtons = row ? row.querySelectorAll('button') : [];
    expect(actionButtons.length).toBeGreaterThanOrEqual(2);

    await user.click(actionButtons[0]!);

    expect(screen.getByTestId('edit-task-category-dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('edit-task-category-dialog')).toHaveAttribute(
      'data-category',
      'selected'
    );
  });

  it('confirms deletion and calls the delete mutation', async () => {
    const mutate = vi.fn((_id: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [
        {
          categoryId: 'CATEGORY-2',
          name: '보고',
          isActive: true,
          createdAt: '2025-01-02T09:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
    vi.mocked(useDeleteTaskCategory).mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useDeleteTaskCategory>);

    const user = userEvent.setup();
    render(<TaskCategories />);

    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'false');

    const row = screen.getByText('보고').closest('tr');
    expect(row).not.toBeNull();

    const actionButtons = row ? row.querySelectorAll('button') : [];
    expect(actionButtons.length).toBeGreaterThanOrEqual(2);

    await user.click(actionButtons[1]!);

    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(mutate).toHaveBeenCalledWith(
      'CATEGORY-2',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'false');
  });
});
