import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUpdateTodo } from '@web/hooks/use-todos';
import { createTodo } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditTodoDialog } from '../edit-todo-dialog';

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

vi.mock('@web/hooks/use-todos', () => ({
  useUpdateTodo: vi.fn(),
}));

describe('EditTodoDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUpdateTodo).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTodo>);
  });

  describe('dialog visibility', () => {
    it('does not render when open is false', () => {
      const todo = createTodo();

      render(<EditTodoDialog todo={todo} open={false} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      const todo = createTodo();

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('does not render when todo is null', () => {
      render(<EditTodoDialog todo={null} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form initialization', () => {
    it('pre-fills form with todo data', () => {
      const todo = createTodo({
        title: '테스트 할일',
        description: '상세 설명입니다',
        status: '진행중',
        dueDate: '2026-01-15T00:00:00Z',
        waitUntil: '2026-01-10T00:00:00Z',
        repeatRule: 'WEEKLY',
        recurrenceType: 'DUE_DATE',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByLabelText('제목')).toHaveValue('테스트 할일');
      expect(screen.getByLabelText('설명 (선택사항)')).toHaveValue('상세 설명입니다');
      expect(screen.getByLabelText('상태')).toHaveValue('진행중');
      expect(screen.getByLabelText('마감일 (선택사항)')).toHaveValue('2026-01-15');
      expect(screen.getByLabelText('대기일 (선택사항)')).toHaveValue('2026-01-10');
      expect(screen.getByLabelText('반복 설정')).toHaveValue('WEEKLY');
    });

    it('shows custom interval fields when repeat rule is CUSTOM', () => {
      const todo = createTodo({
        title: '커스텀 반복 할일',
        repeatRule: 'CUSTOM',
        customInterval: 2,
        customUnit: 'WEEK',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('주')).toBeInTheDocument();
    });

    it('shows skip weekends checkbox when repeat rule is not NONE', () => {
      const todo = createTodo({
        title: '반복 할일',
        repeatRule: 'DAILY',
        skipWeekends: true,
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByLabelText(/주말 제외/)).toBeChecked();
    });

    it('shows recurrence type selector when repeat rule is not NONE', () => {
      const todo = createTodo({
        title: '반복 할일',
        repeatRule: 'MONTHLY',
        recurrenceType: 'COMPLETION_DATE',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByLabelText('반복 기준')).toHaveValue('COMPLETION_DATE');
    });

    it('clamps dueDate to waitUntil on initialization when dueDate is earlier', () => {
      const todo = createTodo({
        title: '날짜 보정 할일',
        dueDate: '2026-01-10T00:00:00Z',
        waitUntil: '2026-01-15T00:00:00Z',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByLabelText('대기일 (선택사항)')).toHaveValue('2026-01-15');
      expect(screen.getByLabelText('마감일 (선택사항)')).toHaveValue('2026-01-15');
    });
  });

  describe('form submission', () => {
    it('submits form with updated data and closes dialog', async () => {
      mockMutateAsync.mockResolvedValue({});
      const todo = createTodo({
        id: 'todo-1',
        title: '원래 제목',
        status: '진행중',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.clear(screen.getByLabelText('제목'));
      await user.type(screen.getByLabelText('제목'), '수정된 제목');
      await user.type(screen.getByLabelText('설명 (선택사항)'), '새로운 설명');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: 'todo-1',
          data: expect.objectContaining({
            title: '수정된 제목',
            description: '새로운 설명',
            status: '진행중',
          }),
        });
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not submit when title is empty', async () => {
      const todo = createTodo({
        title: '원래 제목',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.clear(screen.getByLabelText('제목'));
      await user.click(screen.getByRole('button', { name: '저장' }));

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('submits with custom repeat settings', async () => {
      mockMutateAsync.mockResolvedValue({});
      const todo = createTodo({
        id: 'todo-1',
        title: '할일',
        repeatRule: 'CUSTOM',
        customInterval: 3,
        customUnit: 'MONTH',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: 'todo-1',
          data: expect.objectContaining({
            repeatRule: 'CUSTOM',
            customInterval: 3,
            customUnit: 'MONTH',
          }),
        });
      });
    });

    it('clears dates when status changes to ON_HOLD', async () => {
      mockMutateAsync.mockResolvedValue({});
      const todo = createTodo({
        id: 'todo-1',
        title: '할일',
        status: '진행중',
        dueDate: '2026-01-15T00:00:00Z',
        waitUntil: '2026-01-10T00:00:00Z',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.selectOptions(screen.getByLabelText('상태'), '보류');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: 'todo-1',
          data: expect.objectContaining({
            status: '보류',
            dueDate: undefined,
            waitUntil: undefined,
          }),
        });
      });
    });

    it('sets dueDate from waitUntil when dueDate is empty', async () => {
      mockMutateAsync.mockResolvedValue({});
      const todo = createTodo({
        id: 'todo-1',
        title: '할일',
        status: '진행중',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByLabelText('대기일 (선택사항)'), '2026-02-01');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: 'todo-1',
          data: expect.objectContaining({
            dueDate: '2026-02-01T00:00:00.000Z',
            waitUntil: '2026-02-01T00:00:00.000Z',
          }),
        });
      });
    });

    it('updates dueDate to waitUntil when existing dueDate is earlier', async () => {
      const todo = createTodo({
        id: 'todo-1',
        title: '할일',
        status: '진행중',
        dueDate: '2026-01-10T00:00:00Z',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByLabelText('대기일 (선택사항)'), '2026-01-15');

      expect(screen.getByLabelText('마감일 (선택사항)')).toHaveValue('2026-01-15');
    });

    it('clamps dueDate to waitUntil on submit when dueDate is manually set earlier', async () => {
      mockMutateAsync.mockResolvedValue({});
      const todo = createTodo({
        id: 'todo-1',
        title: '할일',
        status: '진행중',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByLabelText('대기일 (선택사항)'), '2026-01-15');
      await user.clear(screen.getByLabelText('마감일 (선택사항)'));
      await user.type(screen.getByLabelText('마감일 (선택사항)'), '2026-01-10');
      await user.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: 'todo-1',
          data: expect.objectContaining({
            dueDate: '2026-01-15T00:00:00.000Z',
            waitUntil: '2026-01-15T00:00:00.000Z',
          }),
        });
      });
    });
  });

  describe('cancel button', () => {
    it('closes dialog when cancel button is clicked', async () => {
      const todo = createTodo();

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('loading state', () => {
    it('shows loading text when mutation is pending', () => {
      vi.mocked(useUpdateTodo).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      } as unknown as ReturnType<typeof useUpdateTodo>);

      const todo = createTodo();

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeInTheDocument();
    });

    it('disables buttons when mutation is pending', () => {
      vi.mocked(useUpdateTodo).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      } as unknown as ReturnType<typeof useUpdateTodo>);

      const todo = createTodo();

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    });
  });

  describe('form fields visibility', () => {
    it('hides custom interval fields when repeat rule is not CUSTOM', () => {
      const todo = createTodo({
        title: '할일',
        repeatRule: 'DAILY',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      // Custom interval input should not be present
      expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument();
    });

    it('hides skip weekends checkbox when repeat rule is NONE', () => {
      const todo = createTodo({
        title: '할일',
        repeatRule: 'NONE',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByLabelText(/주말 제외/)).not.toBeInTheDocument();
    });

    it('hides recurrence type selector when repeat rule is NONE', () => {
      const todo = createTodo({
        title: '할일',
        repeatRule: 'NONE',
      });

      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByLabelText('반복 기준')).not.toBeInTheDocument();
    });
  });

  describe('repeat rule changes', () => {
    it('shows custom interval fields when changing to CUSTOM', async () => {
      const todo = createTodo({
        title: '할일',
        repeatRule: 'NONE',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.selectOptions(screen.getByLabelText('반복 설정'), 'CUSTOM');

      expect(screen.getByText('커스텀 반복 간격')).toBeInTheDocument();
    });

    it('shows skip weekends when changing from NONE to DAILY', async () => {
      const todo = createTodo({
        title: '할일',
        repeatRule: 'NONE',
      });

      const user = userEvent.setup();
      render(<EditTodoDialog todo={todo} open={true} onOpenChange={mockOnOpenChange} />);

      await user.selectOptions(screen.getByLabelText('반복 설정'), 'DAILY');

      expect(screen.getByLabelText(/주말 제외/)).toBeInTheDocument();
    });
  });

  describe('workNoteId prop', () => {
    it('passes workNoteId to useUpdateTodo hook', () => {
      const todo = createTodo();

      render(
        <EditTodoDialog
          todo={todo}
          open={true}
          onOpenChange={mockOnOpenChange}
          workNoteId="work-note-1"
        />
      );

      expect(useUpdateTodo).toHaveBeenCalledWith('work-note-1');
    });
  });
});
