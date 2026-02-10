import userEvent from '@testing-library/user-event';
import { render, screen } from '@web/test/setup';
import { describe, expect, it, vi } from 'vitest';

import AILogs from '../ai-logs';
import { useAIGatewayLogs } from '../hooks/use-ai-gateway-logs';

vi.mock('../hooks/use-ai-gateway-logs', () => ({
  useAIGatewayLogs: vi.fn(),
}));

function createHookState(
  overrides: Partial<ReturnType<typeof useAIGatewayLogs>> = {}
): ReturnType<typeof useAIGatewayLogs> {
  return {
    logs: [],
    pagination: { page: 1, perPage: 20, count: 0, totalCount: 0, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    error: null,
    searchInput: '',
    startDateInput: '2026-02-09T12:00',
    endDateInput: '2026-02-10T12:00',
    perPage: 20,
    setSearchInput: vi.fn(),
    setStartDateInput: vi.fn(),
    setEndDateInput: vi.fn(),
    setPerPage: vi.fn(),
    applyFilters: vi.fn(),
    refresh: vi.fn(),
    canGoPrev: false,
    canGoNext: false,
    goPrev: vi.fn(),
    goNext: vi.fn(),
    ...overrides,
  };
}

describe('ai-logs page', () => {
  it('shows loading state', () => {
    vi.mocked(useAIGatewayLogs).mockReturnValue(createHookState({ isLoading: true }));

    render(<AILogs />);

    expect(screen.getByText('AI 로그')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useAIGatewayLogs).mockReturnValue(createHookState({ error: '조회 실패' }));

    render(<AILogs />);

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
  });

  it('shows empty state when no logs exist', () => {
    vi.mocked(useAIGatewayLogs).mockReturnValue(createHookState());

    render(<AILogs />);

    expect(screen.getByText('조회 조건에 해당하는 로그가 없습니다.')).toBeInTheDocument();
  });

  it('renders logs table when data exists', () => {
    vi.mocked(useAIGatewayLogs).mockReturnValue(
      createHookState({
        logs: [
          {
            id: 'log-1',
            createdAt: '2026-02-10T12:00:00.000Z',
            startedAt: null,
            provider: 'openai',
            model: 'gpt-5.2',
            path: '/openai/chat/completions',
            requestType: 'chat.completions',
            statusCode: 200,
            success: true,
            tokensIn: 11,
            tokensOut: 7,
            event: 'response',
            cached: false,
          },
        ],
        pagination: {
          page: 1,
          perPage: 20,
          count: 1,
          totalCount: 1,
          totalPages: 1,
        },
      })
    );

    render(<AILogs />);

    expect(screen.getByText('/openai/chat/completions')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('chat.completions')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('triggers page navigation actions', async () => {
    const user = userEvent.setup();
    const goPrev = vi.fn();
    const goNext = vi.fn();

    vi.mocked(useAIGatewayLogs).mockReturnValue(
      createHookState({
        pagination: { page: 2, perPage: 20, count: 20, totalCount: 55, totalPages: 3 },
        canGoPrev: true,
        canGoNext: true,
        goPrev,
        goNext,
      })
    );

    render(<AILogs />);

    await user.click(screen.getByRole('button', { name: '이전' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(goPrev).toHaveBeenCalledTimes(1);
    expect(goNext).toHaveBeenCalledTimes(1);
  });
});
