import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateMeetingMinute,
  useDeleteMeetingMinute,
  useMeetingMinutes,
  useUpdateMeetingMinute,
} from '../use-meeting-minutes';

vi.mock('@web/lib/api', () => ({
  API: {
    getMeetingMinutes: vi.fn(),
    createMeetingMinute: vi.fn(),
    updateMeetingMinute: vi.fn(),
    deleteMeetingMinute: vi.fn(),
  },
}));

describe('useMeetingMinutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches with filter queryKey and respects enabled=false', async () => {
    const filters = {
      q: '회의',
      meetingDateFrom: '2026-02-01',
      meetingDateTo: '2026-02-29',
      page: 1,
      pageSize: 10,
    };
    const response = {
      items: [
        {
          meetingId: 'MEET-001',
          meetingDate: '2026-02-11',
          topic: '주간 회의',
          detailsRaw: '내용',
          keywords: ['주간', '회의'],
          createdAt: '2026-02-11T09:00:00.000Z',
          updatedAt: '2026-02-11T09:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    vi.mocked(API.getMeetingMinutes).mockResolvedValue(response);

    const queryClient = createTestQueryClient();
    const { result } = renderHookWithClient(() => useMeetingMinutes(filters), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getMeetingMinutes).toHaveBeenCalledWith(filters);
    expect(queryClient.getQueryData(['meeting-minutes', filters])).toEqual(response);

    const disabledFilters = { q: 'disabled' };
    const { result: disabledResult } = renderHookWithClient(
      () => useMeetingMinutes(disabledFilters, false),
      { queryClient }
    );

    expect(disabledResult.current.fetchStatus).toBe('idle');
    expect(disabledResult.current.data).toBeUndefined();
    expect(API.getMeetingMinutes).toHaveBeenCalledTimes(1);
  });

  it('invalidates list/detail query keys for create/update/delete mutations', async () => {
    const created = {
      meetingId: 'MEET-001',
      meetingDate: '2026-02-11',
      topic: '주간 회의',
      detailsRaw: '내용',
      keywords: ['주간', '회의'],
      attendees: [{ personId: 'P1', name: '홍길동' }],
      categories: [{ categoryId: 'C1', name: '기획' }],
      createdAt: '2026-02-11T09:00:00.000Z',
      updatedAt: '2026-02-11T09:00:00.000Z',
    };
    vi.mocked(API.createMeetingMinute).mockResolvedValue(created);
    vi.mocked(API.updateMeetingMinute).mockResolvedValue({
      ...created,
      topic: '주간 회의 수정',
      updatedAt: '2026-02-11T10:00:00.000Z',
    });
    vi.mocked(API.deleteMeetingMinute).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result: createResult } = renderHookWithClient(() => useCreateMeetingMinute(), {
      queryClient,
    });
    const { result: updateResult } = renderHookWithClient(() => useUpdateMeetingMinute(), {
      queryClient,
    });
    const { result: deleteResult } = renderHookWithClient(() => useDeleteMeetingMinute(), {
      queryClient,
    });

    await act(async () => {
      createResult.current.mutate({
        meetingDate: '2026-02-11',
        topic: '주간 회의',
        detailsRaw: '내용',
        attendeePersonIds: ['P1'],
      });
    });

    await waitFor(() => {
      expect(createResult.current.isSuccess).toBe(true);
    });

    await act(async () => {
      updateResult.current.mutate({
        meetingId: 'MEET-001',
        data: { topic: '주간 회의 수정' },
      });
    });

    await waitFor(() => {
      expect(updateResult.current.isSuccess).toBe(true);
    });

    await act(async () => {
      deleteResult.current.mutate('MEET-001');
    });

    await waitFor(() => {
      expect(deleteResult.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['meeting-minutes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['meeting-minute-detail', 'MEET-001'] });
  });
});
