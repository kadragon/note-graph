import userEvent from '@testing-library/user-event';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MeetingMinutes from '../meeting-minutes';

vi.mock('@web/hooks/use-meeting-minutes', () => ({
  useMeetingMinutes: vi.fn(),
}));

vi.mock('../meeting-minutes/components/meeting-minutes-table', () => ({
  MeetingMinutesTable: ({
    items,
    onEdit,
  }: {
    items: Array<{ meetingId: string }>;
    onEdit: (meetingId: string) => void;
  }) => (
    <div data-testid="meeting-minutes-table">
      <div>table-count: {items.length}</div>
      {items.map((item) => (
        <button key={item.meetingId} type="button" onClick={() => onEdit(item.meetingId)}>
          edit-{item.meetingId}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../meeting-minutes/components/create-meeting-minute-dialog', () => ({
  CreateMeetingMinuteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-meeting-minute-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../meeting-minutes/components/edit-meeting-minute-dialog', () => ({
  EditMeetingMinuteDialog: ({
    open,
    meetingId,
  }: {
    open: boolean;
    meetingId?: string;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => (
    <div
      data-testid="edit-meeting-minute-dialog"
      data-open={open ? 'true' : 'false'}
      data-meeting-id={meetingId ?? ''}
    />
  ),
}));

describe('meeting-minutes page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const allItems = [
      {
        meetingId: 'MEET-001',
        meetingDate: '2026-02-11',
        topic: '주간 회의',
        detailsRaw: '팀 주간 업무 공유',
      },
      {
        meetingId: 'MEET-002',
        meetingDate: '2026-02-12',
        topic: '기획 리뷰',
        detailsRaw: '신규 기능 기획 검토',
      },
    ];

    vi.mocked(useMeetingMinutes).mockImplementation((query) => {
      const q = query?.q?.trim();
      const filtered = q
        ? allItems.filter((item) => item.topic.includes(q) || item.detailsRaw.includes(q))
        : allItems;

      return {
        data: {
          items: filtered.map((item) => ({
            ...item,
            keywords: [],
            createdAt: '2026-02-11T09:00:00.000Z',
            updatedAt: '2026-02-11T09:00:00.000Z',
          })),
          total: filtered.length,
          page: 1,
          pageSize: 20,
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useMeetingMinutes>;
    });
  });

  it('renders list, applies filters, and opens create/edit dialogs', async () => {
    const user = userEvent.setup();
    render(<MeetingMinutes />);

    expect(screen.getByText('table-count: 2')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '검색어' }), '주간');

    await waitFor(() => {
      expect(screen.getByText('table-count: 1')).toBeInTheDocument();
    });

    expect(vi.mocked(useMeetingMinutes)).toHaveBeenCalledWith({
      q: '주간',
      page: 1,
      pageSize: 20,
    });

    await user.click(screen.getByRole('button', { name: '새 회의록' }));
    expect(screen.getByTestId('create-meeting-minute-dialog')).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByRole('button', { name: 'edit-MEET-001' }));
    expect(screen.getByTestId('edit-meeting-minute-dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('edit-meeting-minute-dialog')).toHaveAttribute(
      'data-meeting-id',
      'MEET-001'
    );
  });
});
