import userEvent from '@testing-library/user-event';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { render, screen, waitFor } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MeetingMinutes from '../meeting-minutes';

vi.mock('@web/hooks/use-meeting-minutes', () => ({
  useMeetingMinutes: vi.fn(),
}));

vi.mock('../meeting-minutes/components/meeting-minutes-table', () => ({
  MeetingMinutesTable: ({
    items,
    onView,
    onEdit,
  }: {
    items: Array<{ meetingId: string }>;
    onView: (meetingId: string) => void;
    onEdit: (meetingId: string) => void;
  }) => (
    <div data-testid="meeting-minutes-table">
      <div>table-count: {items.length}</div>
      {items.map((item) => (
        <div key={item.meetingId}>
          <button type="button" onClick={() => onView(item.meetingId)}>
            view-{item.meetingId}
          </button>
          <button type="button" onClick={() => onEdit(item.meetingId)}>
            edit-{item.meetingId}
          </button>
        </div>
      ))}
    </div>
  ),
}));

describe('meeting-minutes page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/meeting-minutes');

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

  it('renders list, applies filters, and navigates on create/view/edit', async () => {
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
    expect(window.location.pathname).toBe('/meeting-minutes/new');

    window.history.pushState({}, '', '/meeting-minutes');

    await user.click(screen.getByRole('button', { name: 'view-MEET-001' }));
    expect(window.location.pathname).toBe('/meeting-minutes/MEET-001');

    window.history.pushState({}, '', '/meeting-minutes');

    await user.click(screen.getByRole('button', { name: 'edit-MEET-001' }));
    expect(window.location.pathname).toBe('/meeting-minutes/MEET-001/edit');
  });

  it('redirects to detail page from id query parameter and removes query param', async () => {
    window.history.pushState({}, '', '/meeting-minutes?id=MEET-001');

    render(<MeetingMinutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/meeting-minutes/MEET-001');
    });
    expect(window.location.search).toBe('');
  });
});
