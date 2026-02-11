import userEvent from '@testing-library/user-event';
import { useMeetingMinute, useUpdateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditMeetingMinuteDialog } from '../edit-meeting-minute-dialog';

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
    categories: Array<{ categoryId: string; name: string }>;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="category-selector">
      <span>Selected Categories: {selectedIds.length}</span>
      <button type="button" onClick={() => onSelectionChange(['cat-2'])}>
        Change Category
      </button>
    </div>
  ),
}));

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: ({
    selectedPersonIds,
    onSelectionChange,
  }: {
    persons: Array<{ personId: string; name: string }>;
    selectedPersonIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="assignee-selector">
      <span>Selected Persons: {selectedPersonIds.length}</span>
      <button type="button" onClick={() => onSelectionChange(['person-2'])}>
        Change Person
      </button>
    </div>
  ),
}));

vi.mock('@web/hooks/use-meeting-minutes', () => ({
  useMeetingMinute: vi.fn(),
  useUpdateMeetingMinute: vi.fn(),
}));

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

describe('EditMeetingMinuteDialog', () => {
  const mockMutateAsync = vi.fn();
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
        attendees: [{ personId: 'person-1', name: '홍길동' }],
        categories: [{ categoryId: 'cat-1', name: '기획' }],
        linkedWorkNoteCount: 2,
        createdAt: '2026-02-11T09:00:00.000Z',
        updatedAt: '2026-02-11T09:00:00.000Z',
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);

    vi.mocked(useUpdateMeetingMinute).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateMeetingMinute>);

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [{ categoryId: 'cat-1', name: '기획', isActive: true }],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    vi.mocked(usePersons).mockReturnValue({
      data: [{ personId: 'person-1', name: '홍길동', email: 'hong@example.com' }],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });

    mockMutateAsync.mockResolvedValue({
      meetingId: 'MEET-001',
      meetingDate: '2026-02-12',
      topic: '주간 회의 수정',
      detailsRaw: '수정된 진행 내용',
      keywords: ['수정', '회의'],
      attendees: [{ personId: 'person-2', name: '김철수' }],
      categories: [{ categoryId: 'cat-2', name: '실행' }],
      createdAt: '2026-02-11T09:00:00.000Z',
      updatedAt: '2026-02-11T10:00:00.000Z',
    });
  });

  it('shows loading while detail is being fetched', () => {
    vi.mocked(useMeetingMinute).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);

    render(<EditMeetingMinuteDialog open={true} onOpenChange={vi.fn()} meetingId="MEET-001" />);

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

    render(<EditMeetingMinuteDialog open={true} onOpenChange={vi.fn()} meetingId="MEET-001" />);

    expect(screen.getByText('회의록 정보를 불러오지 못했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('loads existing values and submits update payload', async () => {
    const user = userEvent.setup();
    render(<EditMeetingMinuteDialog open={true} onOpenChange={vi.fn()} meetingId="MEET-001" />);

    expect(screen.getByDisplayValue('2026-02-11')).toBeInTheDocument();
    expect(screen.getByDisplayValue('주간 회의')).toBeInTheDocument();
    expect(screen.getByDisplayValue('주간 진행 현황 공유')).toBeInTheDocument();
    expect(screen.getByText('연결된 업무노트: 2건')).toBeInTheDocument();
    expect(screen.getByText('주간')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('토픽'));
    await user.type(screen.getByLabelText('토픽'), '주간 회의 수정');
    await user.clear(screen.getByLabelText('회의 내용'));
    await user.type(screen.getByLabelText('회의 내용'), '수정된 진행 내용');
    await user.click(screen.getByRole('button', { name: 'Change Category' }));
    await user.click(screen.getByRole('button', { name: 'Change Person' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        meetingId: 'MEET-001',
        data: {
          meetingDate: '2026-02-11',
          topic: '주간 회의 수정',
          detailsRaw: '수정된 진행 내용',
          attendeePersonIds: ['person-2'],
          categoryIds: ['cat-2'],
        },
      });
    });

    expect(screen.getByText('수정')).toBeInTheDocument();
    expect(screen.getByText('회의')).toBeInTheDocument();
  });

  it('validates required fields before submit', async () => {
    const user = userEvent.setup();
    render(<EditMeetingMinuteDialog open={true} onOpenChange={vi.fn()} meetingId="MEET-001" />);

    await user.clear(screen.getByLabelText('토픽'));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '회의일, 토픽, 회의 내용을 입력해주세요.',
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('requires at least one attendee before submit', async () => {
    const user = userEvent.setup();
    vi.mocked(useMeetingMinute).mockReturnValue({
      data: {
        meetingId: 'MEET-001',
        meetingDate: '2026-02-11',
        topic: '주간 회의',
        detailsRaw: '주간 진행 현황 공유',
        keywords: ['주간', '진행'],
        attendees: [],
        categories: [{ categoryId: 'cat-1', name: '기획' }],
        linkedWorkNoteCount: 2,
        createdAt: '2026-02-11T09:00:00.000Z',
        updatedAt: '2026-02-11T09:00:00.000Z',
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useMeetingMinute>);

    render(<EditMeetingMinuteDialog open={true} onOpenChange={vi.fn()} meetingId="MEET-001" />);

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '참석자를 한 명 이상 선택해주세요.',
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
