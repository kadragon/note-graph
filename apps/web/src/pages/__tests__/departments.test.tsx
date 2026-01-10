import userEvent from '@testing-library/user-event';
import { useDepartments, useUpdateDepartment } from '@web/hooks/use-departments';
import { render, screen } from '@web/test/setup';
import { useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Departments from '../departments';

vi.mock('@web/hooks/use-departments', () => ({
  useDepartments: vi.fn(),
  useUpdateDepartment: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../departments/components/create-department-dialog', () => ({
  CreateDepartmentDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-department-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('departments page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
  });

  it('shows empty state when there are no departments', () => {
    vi.mocked(useDepartments).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(useUpdateDepartment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateDepartment>);

    render(<Departments />);

    expect(screen.getByText('등록된 부서가 없습니다.')).toBeInTheDocument();
  });

  it('opens the create dialog when clicking the add button', async () => {
    vi.mocked(useDepartments).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(useUpdateDepartment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateDepartment>);

    const user = userEvent.setup();
    render(<Departments />);

    expect(screen.getByTestId('create-department-dialog')).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button', { name: '새 부서' }));

    expect(screen.getByTestId('create-department-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('navigates to members list for a department', async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useDepartments).mockReturnValue({
      data: [
        {
          deptName: '개발',
          description: null,
          isActive: true,
          createdAt: '2025-01-01T09:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(useUpdateDepartment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateDepartment>);

    const user = userEvent.setup();
    render(<Departments />);

    await user.click(screen.getByRole('button', { name: '소속 직원' }));

    expect(navigate).toHaveBeenCalledWith('/persons?dept=%EA%B0%9C%EB%B0%9C');
  });

  it('toggles department status via update mutation', async () => {
    const mutate = vi.fn();
    vi.mocked(useDepartments).mockReturnValue({
      data: [
        {
          deptName: '운영',
          description: null,
          isActive: true,
          createdAt: '2025-01-03T09:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(useUpdateDepartment).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateDepartment>);

    const user = userEvent.setup();
    render(<Departments />);

    await user.click(screen.getByRole('button', { name: '폐지' }));

    expect(mutate).toHaveBeenCalledWith({
      deptName: '운영',
      data: { isActive: false },
    });
  });
});
