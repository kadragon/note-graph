import userEvent from '@testing-library/user-event';
import { useCreateDepartment } from '@web/hooks/use-departments';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateDepartmentDialog } from '../create-department-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/hooks/use-departments', () => ({
  useCreateDepartment: vi.fn(),
}));

describe('CreateDepartmentDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dialog visibility', () => {
    it('renders dialog content when open is true', () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      render(<CreateDepartmentDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('새 부서 추가')).toBeInTheDocument();
    });

    it('does not render dialog content when open is false', () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      render(<CreateDepartmentDialog {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form inputs', () => {
    it('renders name input field with label', () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      render(<CreateDepartmentDialog {...defaultProps} />);

      expect(screen.getByLabelText('부서명')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('부서명을 입력하세요')).toBeInTheDocument();
    });

    it('updates input value when typing', async () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const user = userEvent.setup();
      render(<CreateDepartmentDialog {...defaultProps} />);

      const input = screen.getByLabelText('부서명');
      await user.type(input, '개발팀');

      expect(input).toHaveValue('개발팀');
    });
  });

  describe('form submission', () => {
    it('submits form with valid data and closes dialog', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<CreateDepartmentDialog open={true} onOpenChange={onOpenChange} />);

      await user.type(screen.getByLabelText('부서명'), '개발팀');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({ deptName: '개발팀' });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('trims whitespace from name before submission', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const user = userEvent.setup();
      render(<CreateDepartmentDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('부서명'), '  운영팀  ');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({ deptName: '운영팀' });
      });
    });

    it('does not submit form when name is empty', async () => {
      const mutateAsync = vi.fn();
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const user = userEvent.setup();
      render(<CreateDepartmentDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('does not submit form when name contains only whitespace', async () => {
      const mutateAsync = vi.fn();
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const user = userEvent.setup();
      render(<CreateDepartmentDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('부서명'), '   ');
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('clears input after successful submission', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const user = userEvent.setup();
      render(<CreateDepartmentDialog {...defaultProps} />);

      const input = screen.getByLabelText('부서명');
      await user.type(input, '개발팀');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('cancel button', () => {
    it('calls onOpenChange with false when cancel is clicked', async () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<CreateDepartmentDialog open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('loading state', () => {
    it('disables buttons when mutation is pending', () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      render(<CreateDepartmentDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled();
    });

    it('shows loading text on submit button when pending', () => {
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      render(<CreateDepartmentDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('does not close dialog when mutation fails', async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error('Failed'));
      vi.mocked(useCreateDepartment).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreateDepartment>);

      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<CreateDepartmentDialog open={true} onOpenChange={onOpenChange} />);

      await user.type(screen.getByLabelText('부서명'), '개발팀');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalled();
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
