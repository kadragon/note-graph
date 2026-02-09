import userEvent from '@testing-library/user-event';
import { useDeleteWorkNote, useWorkNotesWithStats } from '@web/hooks/use-work-notes';
import { createWorkNoteWithStats, resetFactoryCounter } from '@web/test/factories';
import { render, screen, waitFor, within } from '@web/test/setup';
import type { WorkNoteWithStats } from '@web/types/api';
import { startOfWeek } from 'date-fns';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import WorkNotes from '../work-notes';

vi.mock('@web/hooks/use-work-notes', () => ({
  useWorkNotesWithStats: vi.fn(),
  useDeleteWorkNote: vi.fn(),
}));

vi.mock('@web/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="year-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('../work-notes/components/work-notes-table', () => ({
  WorkNotesTable: ({
    workNotes,
    onDelete,
    sortKey,
    sortDirection,
  }: {
    workNotes: WorkNoteWithStats[];
    onDelete: (workNoteId: string) => void;
    sortKey: 'category' | 'dueDate' | 'title' | 'assignee' | 'todo' | 'createdAt';
    sortDirection: 'asc' | 'desc';
  }) => (
    <div data-testid="work-notes-table">
      <div>sort-key: {sortKey}</div>
      <div>sort-direction: {sortDirection}</div>
      <div>table-count: {workNotes.length}</div>
      {workNotes.map((note) => (
        <button key={note.id} type="button" onClick={() => onDelete(note.id)}>
          delete-{note.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../work-notes/components/create-work-note-dialog', () => ({
  CreateWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/create-from-text-dialog', () => ({
  CreateFromTextDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-from-text-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/create-from-pdf-dialog', () => ({
  CreateFromPDFDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-from-pdf-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/view-work-note-dialog', () => ({
  ViewWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="view-work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('work-notes page', () => {
  const REAL_DATE = Date;
  const FIXED_NOW = new REAL_DATE(2025, 0, 15, 12, 0, 0);

  const useFixedDate = () => {
    class MockDate extends REAL_DATE {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(FIXED_NOW.getTime());
          return;
        }
        // @ts-expect-error allow variadic Date constructor args
        super(...args);
      }

      static now() {
        return FIXED_NOW.getTime();
      }
    }

    // @ts-expect-error override global Date for deterministic tests
    globalThis.Date = MockDate;
  };

  const restoreDate = () => {
    globalThis.Date = REAL_DATE;
  };

  beforeAll(() => {
    useFixedDate();
  });

  afterAll(() => {
    restoreDate();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    vi.mocked(useDeleteWorkNote).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteWorkNote>);
  });

  it('filters work notes into tabs and updates the list on tab change', async () => {
    const now = new Date();
    const today = now.toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekStartISO = weekStart.toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const previousYearDate = new Date(now.getFullYear() - 1, 11, 31).toISOString();

    const workNotes: WorkNoteWithStats[] = [
      createWorkNoteWithStats({
        id: 'work-active-1',
        todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
      }),
      createWorkNoteWithStats({
        id: 'work-active-2',
        todoStats: { total: 2, completed: 0, remaining: 2, pending: 0 },
      }),
      createWorkNoteWithStats({
        id: 'work-pending',
        todoStats: { total: 2, completed: 0, remaining: 0, pending: 2 },
      }),
      createWorkNoteWithStats({
        id: 'work-completed-today',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: today,
      }),
      createWorkNoteWithStats({
        id: 'work-completed-week',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: weekStartISO,
      }),
      createWorkNoteWithStats({
        id: 'work-completed-year',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: monthStart,
      }),
      createWorkNoteWithStats({
        id: 'work-completed-old',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: previousYearDate,
      }),
      createWorkNoteWithStats({
        id: 'work-completed-no-date',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: null,
      }),
      createWorkNoteWithStats({
        id: 'work-completed-invalid-date',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
        latestCompletedAt: 'not-a-date',
      }),
    ];

    vi.mocked(useWorkNotesWithStats).mockReturnValue({
      data: workNotes,
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNotesWithStats>);

    const user = userEvent.setup();
    render(<WorkNotes />);

    expect(screen.getByText('sort-key: dueDate')).toBeInTheDocument();
    expect(screen.getByText('sort-direction: asc')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /진행 중 \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /대기중 \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /완료됨\(오늘\) \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /완료됨\(이번주\) \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /완료됨\(올해\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /완료됨\(전체\)/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /완료됨 \(3\)/ })).toBeInTheDocument();

    const activePanel = screen.getByRole('tabpanel', { name: /진행 중/ });
    expect(within(activePanel).getByText('table-count: 2')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /대기중 \(1\)/ }));
    const pendingPanel = screen.getByRole('tabpanel', { name: /대기중/ });
    expect(within(pendingPanel).getByText('table-count: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /완료됨\(오늘\) \(1\)/ }));
    const completedTodayPanel = screen.getByRole('tabpanel', { name: /완료됨\(오늘\)/ });
    expect(within(completedTodayPanel).getByText('table-count: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /완료됨\(이번주\) \(1\)/ }));
    const completedWeekPanel = screen.getByRole('tabpanel', { name: /완료됨\(이번주\)/ });
    expect(within(completedWeekPanel).getByText('table-count: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /완료됨 \(3\)/ }));
    const completedPanel = screen.getByRole('tabpanel', { name: /완료됨/ });
    expect(screen.getByText('연도:')).toBeInTheDocument();
    expect(screen.getByTestId('year-select')).toHaveValue('2025');
    expect(within(completedPanel).getByText('table-count: 3')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /NaN년/ })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('year-select'), 'all');
    expect(within(completedPanel).getByText('table-count: 6')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /완료됨 \(6\)/ })).toBeInTheDocument();
  });

  it('confirms deletion and calls the delete mutation', async () => {
    const workNotes: WorkNoteWithStats[] = [
      createWorkNoteWithStats({
        id: 'work-delete',
        todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
      }),
    ];

    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteWorkNote).mockReturnValue({
      mutateAsync,
    } as unknown as ReturnType<typeof useDeleteWorkNote>);
    vi.mocked(useWorkNotesWithStats).mockReturnValue({
      data: workNotes,
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNotesWithStats>);

    const user = userEvent.setup();
    render(<WorkNotes />);

    const activePanel = screen.getByRole('tabpanel', { name: /진행 중/ });
    await user.click(within(activePanel).getByRole('button', { name: 'delete-work-delete' }));

    expect(screen.getByText('업무노트 삭제')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('work-delete');
    });
  });
});
