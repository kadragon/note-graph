import {
  useDailyReport,
  useDailyReports,
  useGenerateDailyReport,
} from '@web/hooks/use-daily-report';
import { render, screen } from '@web/test/setup';
import type { DailyReport } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyReportPage from './daily-report';

vi.mock('@web/hooks/use-daily-report', () => ({
  useDailyReport: vi.fn(),
  useDailyReports: vi.fn(),
  useGenerateDailyReport: vi.fn(),
}));

describe('daily report page', () => {
  const buildReport = (overrides: Partial<DailyReport> = {}): DailyReport => ({
    reportId: 'REPORT-1',
    reportDate: '2025-01-10',
    calendarSnapshot: [],
    todosSnapshot: {
      today: [
        {
          id: 'TODO-1',
          title: '오늘 할 일',
          dueDate: '2025-01-10T09:00:00.000Z',
          status: '진행중',
        },
      ],
      backlog: [
        {
          id: 'TODO-2',
          title: '밀린 할 일',
          dueDate: '2025-01-09T09:00:00.000Z',
          status: '진행중',
        },
      ],
      upcoming: [
        {
          id: 'TODO-3',
          title: '다가오는 할 일',
          dueDate: '2025-01-10T23:00:00.000Z',
          status: '진행중',
        },
      ],
    },
    aiAnalysis: {
      scheduleSummary: '요약',
      todoPriorities: [],
      timeAllocation: [],
      conflicts: [],
      progressVsPrevious: '진행',
      actionItems: [],
    },
    previousReportId: null,
    createdAt: '2025-01-10T09:00:00.000Z',
    updatedAt: '2025-01-10T09:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(useDailyReports).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useDailyReports>);
    vi.mocked(useGenerateDailyReport).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useGenerateDailyReport>);
  });

  it('renders the source todo snapshot sections for auditing', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: buildReport(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useDailyReport>);

    render(<DailyReportPage />);

    expect(screen.getByText('오늘 탭 기준 할일')).toBeInTheDocument();
    expect(screen.getByText('오늘 할 일')).toBeInTheDocument();
    expect(screen.getByText('밀린 할 일')).toBeInTheDocument();
    expect(screen.getByText('다가오는 할 일')).toBeInTheDocument();
  });

  it('renders safely when an older report is missing todo snapshot arrays', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: buildReport({
        todosSnapshot: undefined as unknown as DailyReport['todosSnapshot'],
      }),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useDailyReport>);

    render(<DailyReportPage />);

    expect(screen.getByText('참고한 할일 정보가 없습니다.')).toBeInTheDocument();
  });
});
