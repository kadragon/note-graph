import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';

type MeetingMinutesQuery = Parameters<typeof API.getMeetingMinutes>[0];
type MeetingMinutesListResponse = Awaited<ReturnType<typeof API.getMeetingMinutes>>;
type MeetingMinuteDetailResponse = Awaited<ReturnType<typeof API.getMeetingMinute>>;
type CreateMeetingMinuteRequest = Parameters<typeof API.createMeetingMinute>[0];
type UpdateMeetingMinuteRequest = Parameters<typeof API.updateMeetingMinute>[1];

export function useMeetingMinutes(query?: MeetingMinutesQuery, enabled: boolean = true) {
  return useQuery<MeetingMinutesListResponse>({
    queryKey: ['meeting-minutes', query ?? {}],
    queryFn: () => API.getMeetingMinutes(query),
    enabled,
  });
}

export function useMeetingMinute(meetingId?: string, enabled: boolean = true) {
  return useQuery<MeetingMinuteDetailResponse>({
    queryKey: ['meeting-minute-detail', meetingId],
    queryFn: () => {
      if (!meetingId) {
        throw new Error('meetingId is required');
      }
      return API.getMeetingMinute(meetingId);
    },
    enabled: enabled && Boolean(meetingId),
  });
}

export const useCreateMeetingMinute = createStandardMutation({
  mutationFn: (data: CreateMeetingMinuteRequest) => API.createMeetingMinute(data),
  invalidateKeys: (data) => [['meeting-minutes'], ['meeting-minute-detail', data.meetingId]],
  messages: {
    success: '회의록이 생성되었습니다.',
    error: '회의록을 생성할 수 없습니다.',
  },
});

export const useUpdateMeetingMinute = createStandardMutation({
  mutationFn: ({ meetingId, data }: { meetingId: string; data: UpdateMeetingMinuteRequest }) =>
    API.updateMeetingMinute(meetingId, data),
  invalidateKeys: (_data, variables) => [
    ['meeting-minutes'],
    ['meeting-minute-detail', variables.meetingId],
  ],
  messages: {
    success: '회의록이 수정되었습니다.',
    error: '회의록을 수정할 수 없습니다.',
  },
});

export const useDeleteMeetingMinute = createStandardMutation({
  mutationFn: (meetingId: string) => API.deleteMeetingMinute(meetingId),
  invalidateKeys: (_data, meetingId) => [['meeting-minutes'], ['meeting-minute-detail', meetingId]],
  messages: {
    success: '회의록이 삭제되었습니다.',
    error: '회의록을 삭제할 수 없습니다.',
  },
});
