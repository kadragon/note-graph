import userEvent from '@testing-library/user-event';
import { useCreateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateMeetingMinuteDialog } from '../create-meeting-minute-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/components/category-selector', () => ({
  CategorySelector: ({
    selectedIds,
    onSelectionChange,
  }: {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="category-selector">
      <span>Selected Categories: {selectedIds.length}</span>
      <button type="button" onClick={() => onSelectionChange(['cat-1'])}>
        Select Category
      </button>
    </div>
  ),
}));

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: ({
    selectedPersonIds,
    onSelectionChange,
  }: {
    selectedPersonIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="assignee-selector">
      <span>Selected Persons: {selectedPersonIds.length}</span>
      <button type="button" onClick={() => onSelectionChange(['person-1'])}>
        Select Person
      </button>
    </div>
  ),
}));

vi.mock('@web/hooks/use-meeting-minutes', () => ({
  useCreateMeetingMinute: vi.fn(),
}));

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

describe('CreateMeetingMinuteDialog', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      meetingId: 'MEET-001',
      meetingDate: '2026-02-11',
      topic: '주간 회의',
      detailsRaw: '팀 진행 현황 공유',
      keywords: ['주간', '진행현황'],
      attendees: [{ personId: 'person-1', name: '홍길동' }],
      categories: [{ categoryId: 'cat-1', name: '기획' }],
      createdAt: '2026-02-11T09:00:00.000Z',
      updatedAt: '2026-02-11T09:00:00.000Z',
    });

    vi.mocked(useCreateMeetingMinute).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateMeetingMinute>);

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [{ categoryId: 'cat-1', name: '기획', isActive: true }],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    vi.mocked(usePersons).mockReturnValue({
      data: [{ personId: 'person-1', name: '홍길동', email: 'hong@example.com' }],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);
  });

  it('submits attendee/category IDs and renders returned keywords', async () => {
    const user = userEvent.setup();
    render(<CreateMeetingMinuteDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText('회의일'), '2026-02-11');
    await user.type(screen.getByLabelText('토픽'), '주간 회의');
    await user.type(screen.getByLabelText('회의 내용'), '팀 진행 현황 공유');
    await user.click(screen.getByRole('button', { name: 'Select Category' }));
    await user.click(screen.getByRole('button', { name: 'Select Person' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        meetingDate: '2026-02-11',
        topic: '주간 회의',
        detailsRaw: '팀 진행 현황 공유',
        attendeePersonIds: ['person-1'],
        categoryIds: ['cat-1'],
      });
    });

    expect(screen.getByText('키워드')).toBeInTheDocument();
    expect(screen.getByText('주간')).toBeInTheDocument();
    expect(screen.getByText('진행현황')).toBeInTheDocument();
  });
});
