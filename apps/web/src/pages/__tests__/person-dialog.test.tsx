import userEvent from '@testing-library/user-event';
import { useCreateDepartment, useDepartments } from '@web/hooks/use-departments';
import { useCreatePerson, usePersonHistory, useUpdatePerson } from '@web/hooks/use-persons';
import { render, screen, waitFor } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonDialog } from '../persons/components/person-dialog';

vi.mock('@web/hooks/use-persons', () => ({
  useCreatePerson: vi.fn(),
  useUpdatePerson: vi.fn(),
  usePersonHistory: vi.fn(),
}));

vi.mock('@web/hooks/use-departments', () => ({
  useDepartments: vi.fn(),
  useCreateDepartment: vi.fn(),
}));

describe('PersonDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDepartments).mockReturnValue({
      data: [{ deptName: '개발팀' }, { deptName: '디자인팀' }],
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDepartments>);

    vi.mocked(useCreateDepartment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateDepartment>);

    vi.mocked(usePersonHistory).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersonHistory>);
  });

  describe('create mode', () => {
    it('submits form with valid data and closes dialog', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      const user = userEvent.setup();
      render(<PersonDialog open={true} onOpenChange={mockOnOpenChange} mode="create" />);

      await user.type(screen.getByLabelText('이름'), '홍길동');
      await user.type(screen.getByLabelText('사번'), '123456');
      await user.type(screen.getByLabelText('연락처 (선택)'), '3346');
      await user.type(screen.getByLabelText('직책 (선택)'), '과장');

      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({
          name: '홍길동',
          personId: '123456',
          phoneExt: '3346',
          currentDept: undefined,
          currentPosition: '과장',
        });
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows validation error for empty name', async () => {
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      const user = userEvent.setup();
      render(<PersonDialog open={true} onOpenChange={mockOnOpenChange} mode="create" />);

      await user.type(screen.getByLabelText('사번'), '123456');
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(screen.getByText('이름을 입력하세요')).toBeInTheDocument();
    });

    it('shows validation error for invalid personId format', async () => {
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      const user = userEvent.setup();
      render(<PersonDialog open={true} onOpenChange={mockOnOpenChange} mode="create" />);

      await user.type(screen.getByLabelText('이름'), '홍길동');
      await user.type(screen.getByLabelText('사번'), '12345'); // 5 digits instead of 6
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(screen.getByText('사번은 6자리 숫자여야 합니다')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    const initialData = {
      id: 'person-1',
      personId: '123456',
      name: '홍길동',
      phoneExt: '3346',
      currentDept: '개발팀',
      currentPosition: '과장',
      currentRoleDesc: null,
      employmentStatus: '재직' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('pre-fills form with initial data', () => {
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      render(
        <PersonDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          mode="edit"
          initialData={initialData}
        />
      );

      expect(screen.getByLabelText('이름')).toHaveValue('홍길동');
      expect(screen.getByLabelText('사번')).toHaveValue('123456');
      expect(screen.getByLabelText('사번')).toBeDisabled();
      expect(screen.getByLabelText('연락처 (선택)')).toHaveValue('3346');
      expect(screen.getByLabelText('직책 (선택)')).toHaveValue('과장');
    });

    it('submits update with modified data', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      const user = userEvent.setup();
      render(
        <PersonDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          mode="edit"
          initialData={initialData}
        />
      );

      await user.clear(screen.getByLabelText('이름'));
      await user.type(screen.getByLabelText('이름'), '김철수');
      await user.click(screen.getByRole('button', { name: '수정' }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({
          personId: '123456',
          data: {
            name: '김철수',
            phoneExt: '3346',
            currentDept: '개발팀',
            currentPosition: '과장',
          },
        });
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('form reset', () => {
    it('clears errors when cancel button is clicked', async () => {
      vi.mocked(useCreatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePerson>);
      vi.mocked(useUpdatePerson).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useUpdatePerson>);

      const user = userEvent.setup();
      render(<PersonDialog open={true} onOpenChange={mockOnOpenChange} mode="create" />);

      // Trigger validation error
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(screen.getByText('이름을 입력하세요')).toBeInTheDocument();

      // Click cancel
      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
