import userEvent from '@testing-library/user-event';
import { useSearch } from '@web/hooks/use-search';
import { API } from '@web/lib/api';
import { render, screen, waitFor } from '@web/test/setup';
import { useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Search from '../search';

vi.mock('@web/hooks/use-search', () => ({
  useSearch: vi.fn(),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    getWorkNote: vi.fn(),
  },
}));

vi.mock('@web/pages/work-notes/components/view-work-note-dialog', () => ({
  ViewWorkNoteDialog: ({
    open,
    workNote,
    loading,
  }: {
    open: boolean;
    workNote: { id?: string } | null;
    loading?: boolean;
  }) => (
    <div
      data-testid="work-note-dialog"
      data-open={open ? 'true' : 'false'}
      data-work-id={workNote?.id ?? ''}
      data-loading={loading ? 'true' : 'false'}
    />
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

describe('search page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates search params on submit', async () => {
    const setSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), setSearchParams]);
    vi.mocked(useSearch).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isSuccess: false,
      isPending: false,
    } as unknown as ReturnType<typeof useSearch>);

    const user = userEvent.setup();
    render(<Search />);

    await user.type(screen.getByPlaceholderText('검색어를 입력하세요'), '  검색어  ');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(setSearchParams).toHaveBeenCalledWith({ q: '검색어' });
  });

  it('renders results summary and triggers search for url query', async () => {
    const setSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('q=테스트'), setSearchParams]);

    const mutate = vi.fn();
    vi.mocked(useSearch).mockReturnValue({
      mutate,
      isSuccess: true,
      isPending: false,
      data: {
        query: '테스트',
        workNotes: [
          {
            id: 'work-1',
            title: '업무노트 결과',
            category: '일반',
            score: 0.9,
            source: 'hybrid',
            createdAt: new Date().toISOString(),
          },
        ],
        persons: [
          {
            personId: '100001',
            name: '홍길동',
            currentDept: '개발',
            currentPosition: '매니저',
            phoneExt: '1234',
            employmentStatus: '재직',
          },
        ],
        departments: [
          {
            deptName: '개발',
            description: null,
            isActive: true,
          },
        ],
      },
    } as unknown as ReturnType<typeof useSearch>);

    render(<Search />);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ query: '테스트' });
    });

    expect(screen.getByText('총 3개의 결과를 찾았습니다.')).toBeInTheDocument();
    expect(screen.getByText('업무노트 결과')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getAllByText('개발')[0]).toBeInTheDocument();
  });

  it('opens work note dialog when selecting a work note result', async () => {
    const setSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('q=테스트'), setSearchParams]);

    vi.mocked(useSearch).mockReturnValue({
      mutate: vi.fn(),
      isSuccess: true,
      isPending: false,
      data: {
        query: '테스트',
        workNotes: [
          {
            id: 'work-1',
            title: '업무노트 결과',
            category: '일반',
            score: 0.9,
            source: 'hybrid',
            createdAt: new Date().toISOString(),
          },
        ],
        persons: [],
        departments: [],
      },
    } as unknown as ReturnType<typeof useSearch>);

    vi.mocked(API.getWorkNote).mockResolvedValue({
      id: 'work-1',
      title: '업무노트 결과',
      content: '상세 내용',
      category: '일반',
      categories: [],
      persons: [],
      relatedWorkNotes: [],
      files: [],
      createdAt: '2025-01-01T09:00:00.000Z',
      updatedAt: '2025-01-01T09:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<Search />);

    await waitFor(() => {
      expect(screen.getByText('업무노트 결과')).toBeInTheDocument();
    });

    await user.click(screen.getByText('업무노트 결과'));

    await waitFor(() => {
      expect(API.getWorkNote).toHaveBeenCalledWith('work-1');
    });

    expect(screen.getByTestId('work-note-dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('work-note-dialog')).toHaveAttribute('data-work-id', 'work-1');
  });

  it('shows loading state while fetching work note details', async () => {
    const setSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('q=테스트'), setSearchParams]);

    vi.mocked(useSearch).mockReturnValue({
      mutate: vi.fn(),
      isSuccess: true,
      isPending: false,
      data: {
        query: '테스트',
        workNotes: [
          {
            id: 'work-1',
            title: '업무노트 결과',
            category: '일반',
            score: 0.9,
            source: 'hybrid',
            createdAt: new Date().toISOString(),
          },
        ],
        persons: [],
        departments: [],
      },
    } as unknown as ReturnType<typeof useSearch>);

    // Simulate a slow API response that never resolves during this test
    vi.mocked(API.getWorkNote).mockImplementation(
      () => new Promise(() => {}) // Never resolves - stays in loading state
    );

    const user = userEvent.setup();
    render(<Search />);

    await waitFor(() => {
      expect(screen.getByText('업무노트 결과')).toBeInTheDocument();
    });

    await user.click(screen.getByText('업무노트 결과'));

    // Dialog should be open and in loading state
    await waitFor(() => {
      expect(screen.getByTestId('work-note-dialog')).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('work-note-dialog')).toHaveAttribute('data-loading', 'true');
    });
  });
});
