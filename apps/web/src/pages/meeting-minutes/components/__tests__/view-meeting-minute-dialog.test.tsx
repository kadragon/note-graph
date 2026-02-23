import userEvent from '@testing-library/user-event';
import { useMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewMeetingMinuteDialog } from '../view-meeting-minute-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/hooks/use-meeting-minutes', () => ({
  useMeetingMinute: vi.fn(),
}));

describe('ViewMeetingMinuteDialog', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useMeetingMinute).mockReturnValue({
      data: {
        meetingId: 'MEET-001',
        meetingDate: '2026-02-11',
        topic: '주간 회의',
        detailsRaw: '주간 진행 현황 공유',
        keywords: ['주간', '진행'],
        attendees: [
          { personId: 'person-1', name: '홍길동' },
          { personId: 'person-2', name: '김철수' },
        ],
        categories: [{ categoryId: 'cat-1', name: '기획' }],
        linkedWorkNoteCount: 2,
        createdAt: '2026-02-11T09:00:00.000Z',
        updatedAt: '2026-02-11T10:00:00.000Z',
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);
  });

  it('shows loading while detail is being fetched', () => {
    vi.mocked(useMeetingMinute).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);

    render(
      <ViewMeetingMinuteDialog
        open={true}
        onOpenChange={vi.fn()}
        meetingId="MEET-001"
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('회의록 정보를 불러오는 중...')).toBeInTheDocument();
  });

  it('shows error state and retries fetching detail', async () => {
    const user = userEvent.setup();

    vi.mocked(useMeetingMinute).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);

    render(
      <ViewMeetingMinuteDialog
        open={true}
        onOpenChange={vi.fn()}
        meetingId="MEET-001"
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('회의록 정보를 불러오지 못했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders read-only detail fields', () => {
    render(
      <ViewMeetingMinuteDialog
        open={true}
        onOpenChange={vi.fn()}
        meetingId="MEET-001"
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('회의일')).toBeInTheDocument();
    expect(screen.getByText('2026-02-11')).toBeInTheDocument();
    expect(screen.getByText('토픽')).toBeInTheDocument();
    expect(screen.getByText('주간 회의')).toBeInTheDocument();
    expect(screen.getByText('회의 내용')).toBeInTheDocument();
    expect(screen.getByText('주간 진행 현황 공유')).toBeInTheDocument();
    expect(screen.getByText('참석자')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('김철수')).toBeInTheDocument();
    expect(screen.getByText('업무 구분')).toBeInTheDocument();
    expect(screen.getByText('기획')).toBeInTheDocument();
    expect(screen.getByText('키워드')).toBeInTheDocument();
    expect(screen.getByText('주간')).toBeInTheDocument();
    expect(screen.getByText('진행')).toBeInTheDocument();
    expect(screen.getByText('연결된 업무노트: 2건')).toBeInTheDocument();
    expect(screen.getByText(/생성일:/)).toBeInTheDocument();
    expect(screen.getByText(/수정일:/)).toBeInTheDocument();
  });

  it('calls onEdit with meeting id when edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <ViewMeetingMinuteDialog
        open={true}
        onOpenChange={vi.fn()}
        meetingId="MEET-001"
        onEdit={onEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: '수정' }));
    expect(onEdit).toHaveBeenCalledWith('MEET-001');
  });
});
