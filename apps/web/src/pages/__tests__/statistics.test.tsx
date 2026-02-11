import userEvent from '@testing-library/user-event';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Statistics from '../statistics';
import { useStatistics } from '../statistics/hooks/use-statistics';

vi.mock('../statistics/hooks/use-statistics', () => ({
  useStatistics: vi.fn(),
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
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('../statistics/components/summary-cards', () => ({
  SummaryCards: ({ totalWorkNotes }: { totalWorkNotes: number }) => (
    <div data-testid="summary-cards" data-total-work-notes={totalWorkNotes} />
  ),
}));

vi.mock('../statistics/components/distribution-charts', () => ({
  DistributionCharts: ({ byCategory }: { byCategory: Array<unknown> }) => (
    <div data-testid="distribution-charts" data-count={byCategory.length} />
  ),
}));

vi.mock('../statistics/components/work-notes-table', () => ({
  WorkNotesTable: ({ workNotes }: { workNotes: Array<unknown> }) => (
    <div data-testid="work-notes-table" data-count={workNotes.length} />
  ),
}));

vi.mock('@web/pages/work-notes/components/view-work-note-dialog', () => ({
  ViewWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('statistics page', () => {
  it('renders summary, charts, and work notes when statistics are available', () => {
    vi.mocked(useStatistics).mockReturnValue({
      period: 'this-week',
      setPeriod: vi.fn(),
      year: 2025,
      setYear: vi.fn(),
      dateRange: {
        startDate: '2025-01-01',
        endDate: '2025-01-07',
      },
      statistics: {
        summary: {
          totalWorkNotes: 3,
          totalCompletedTodos: 7,
          totalTodos: 9,
          completionRate: 77.7,
        },
        distributions: {
          byCategory: [{ categoryId: 'CAT-1', categoryName: '개발', count: 2 }],
          byPerson: [],
          byDepartment: [],
        },
        workNotes: [
          {
            workId: 'WORK-1',
            title: '테스트 업무',
            contentRaw: '',
            category: '일반',
            categoryName: null,
            createdAt: '2025-01-01T09:00:00.000Z',
            completedTodoCount: 1,
            totalTodoCount: 2,
            updatedAt: '2025-01-02',
            embeddedAt: null,
            assignedPersons: [],
          },
        ],
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Statistics />);

    expect(screen.getByText('통계 대시보드')).toBeInTheDocument();
    expect(screen.getByText('조회 기간: 이번주 (2025.01.01 - 2025.01.07)')).toBeInTheDocument();
    expect(screen.getByTestId('summary-cards')).toHaveAttribute('data-total-work-notes', '3');
    expect(screen.getByTestId('distribution-charts')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('work-notes-table')).toHaveAttribute('data-count', '1');
  });

  it('shows year selector for half-year periods and updates year', async () => {
    const setYear = vi.fn();
    vi.mocked(useStatistics).mockReturnValue({
      period: 'first-half',
      setPeriod: vi.fn(),
      year: 2025,
      setYear,
      dateRange: {
        startDate: '2025-01-01',
        endDate: '2025-06-30',
      },
      statistics: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(<Statistics />);

    expect(screen.getByText('연도:')).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('year-select'), '2024');

    expect(setYear).toHaveBeenCalledWith(2024);
  });
});
