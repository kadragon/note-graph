import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VectorStore from '../vector-store';

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  };
});

vi.mock('@web/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => (
    <div data-testid="alert-dialog">{children}</div>
  ),
  AlertDialogTrigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => (
    <div data-testid="alert-dialog-trigger" data-aschild={asChild ? 'true' : 'false'}>
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

vi.mock('@web/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('vector-store page', () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;
  let mockEmbedPendingMutate: ReturnType<typeof vi.fn>;
  let mockReindexAllMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInvalidateQueries = vi.fn();
    mockEmbedPendingMutate = vi.fn();
    mockReindexAllMutate = vi.fn();

    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as unknown as ReturnType<typeof useQueryClient>);
  });

  function setupMocks(options: {
    stats?: { total: number; embedded: number; pending: number } | undefined;
    isLoading?: boolean;
    embedPendingIsPending?: boolean;
    reindexAllIsPending?: boolean;
  }) {
    const {
      stats,
      isLoading = false,
      embedPendingIsPending = false,
      reindexAllIsPending = false,
    } = options;

    vi.mocked(useQuery).mockReturnValue({
      data: stats,
      isLoading,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useMutation)
      .mockReturnValueOnce({
        mutate: mockEmbedPendingMutate,
        isPending: embedPendingIsPending,
      } as unknown as ReturnType<typeof useMutation>)
      .mockReturnValueOnce({
        mutate: mockReindexAllMutate,
        isPending: reindexAllIsPending,
      } as unknown as ReturnType<typeof useMutation>);
  }

  it('renders page title and description', () => {
    setupMocks({ stats: { total: 0, embedded: 0, pending: 0 } });
    render(<VectorStore />);

    expect(screen.getByText('벡터 스토어 관리')).toBeInTheDocument();
    expect(screen.getByText('업무노트 임베딩 현황을 확인하고 관리합니다')).toBeInTheDocument();
  });

  it('shows loading spinners when stats are loading', () => {
    setupMocks({ isLoading: true });
    render(<VectorStore />);

    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBe(3);
  });

  it('displays stats correctly when data is loaded', () => {
    setupMocks({ stats: { total: 100, embedded: 75, pending: 25 } });
    render(<VectorStore />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('75% 완료')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage when total > 0', () => {
    setupMocks({ stats: { total: 100, embedded: 50, pending: 50 } });
    render(<VectorStore />);

    expect(screen.getByText('임베딩 진행률')).toBeInTheDocument();
    expect(screen.getByText('50 / 100 (50%)')).toBeInTheDocument();
  });

  it('does not show progress bar when total is 0', () => {
    setupMocks({ stats: { total: 0, embedded: 0, pending: 0 } });
    render(<VectorStore />);

    expect(screen.queryByText('임베딩 진행률')).not.toBeInTheDocument();
  });

  it('shows pending warning when there are pending embeddings', () => {
    setupMocks({ stats: { total: 100, embedded: 80, pending: 20 } });
    render(<VectorStore />);

    expect(screen.getByText('20개의 업무노트가 임베딩 대기 중입니다')).toBeInTheDocument();
    expect(
      screen.getByText('"미완료 임베딩 처리" 버튼을 클릭하여 벡터 스토어에 저장하세요.')
    ).toBeInTheDocument();
  });

  it('shows success message when all embeddings are complete', () => {
    setupMocks({ stats: { total: 100, embedded: 100, pending: 0 } });
    render(<VectorStore />);

    expect(screen.getByText('모든 업무노트가 벡터화되었습니다')).toBeInTheDocument();
    expect(
      screen.getByText('AI 검색 및 챗봇에서 모든 업무노트를 활용할 수 있습니다.')
    ).toBeInTheDocument();
  });

  it('disables embed pending button when pending is 0', () => {
    setupMocks({ stats: { total: 100, embedded: 100, pending: 0 } });
    render(<VectorStore />);

    const embedButton = screen.getByRole('button', { name: /미완료 임베딩 처리/ });
    expect(embedButton).toBeDisabled();
  });

  it('enables embed pending button when pending > 0', () => {
    setupMocks({ stats: { total: 100, embedded: 80, pending: 20 } });
    render(<VectorStore />);

    const embedButton = screen.getByRole('button', { name: /미완료 임베딩 처리/ });
    expect(embedButton).toBeEnabled();
  });

  it('calls embed pending mutation when button is clicked', async () => {
    setupMocks({ stats: { total: 100, embedded: 80, pending: 20 } });
    const user = userEvent.setup();
    render(<VectorStore />);

    await user.click(screen.getByRole('button', { name: /미완료 임베딩 처리/ }));

    expect(mockEmbedPendingMutate).toHaveBeenCalled();
  });

  it('disables buttons when embedding is in progress', () => {
    setupMocks({
      stats: { total: 100, embedded: 80, pending: 20 },
      embedPendingIsPending: true,
    });
    render(<VectorStore />);

    const embedButton = screen.getByRole('button', { name: /미완료 임베딩 처리/ });
    const reindexButton = screen.getByRole('button', { name: /전체 재인덱싱/ });

    expect(embedButton).toBeDisabled();
    expect(reindexButton).toBeDisabled();
  });

  it('shows reindex confirmation dialog content', () => {
    setupMocks({ stats: { total: 50, embedded: 50, pending: 0 } });
    render(<VectorStore />);

    expect(
      screen.getByText('모든 업무노트를 다시 임베딩합니다. 이 작업은 시간이 오래 걸릴 수 있습니다.')
    ).toBeInTheDocument();
    expect(screen.getByText('총 50개의 업무노트가 재인덱싱됩니다.')).toBeInTheDocument();
  });

  it('calls reindex all mutation when confirmation is clicked', async () => {
    setupMocks({ stats: { total: 50, embedded: 50, pending: 0 } });
    const user = userEvent.setup();
    render(<VectorStore />);

    await user.click(screen.getByRole('button', { name: '재인덱싱 시작' }));

    expect(mockReindexAllMutate).toHaveBeenCalled();
  });

  it('shows 0 values when stats are undefined', () => {
    setupMocks({ stats: undefined });
    render(<VectorStore />);

    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(3);
  });

  it('shows pending notice text when pending > 0', () => {
    setupMocks({ stats: { total: 100, embedded: 80, pending: 20 } });
    render(<VectorStore />);

    expect(screen.getByText('처리 필요')).toBeInTheDocument();
  });
});
