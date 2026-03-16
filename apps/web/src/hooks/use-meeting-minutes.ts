import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export function useRefineMeetingMinute() {
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const mutation = useMutation({
    mutationFn: ({ meetingId, transcript }: { meetingId: string; transcript: string }) =>
      API.refineMeetingMinute(meetingId, { transcript }),
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'AI 정제 요청에 실패했습니다. 다시 시도해주세요.',
      });
    },
  });

  const startPolling = useCallback(
    (jobId: string, onSuccess: (refinedContent: string) => void) => {
      setIsPolling(true);

      timeoutRef.current = setTimeout(() => {
        cleanup();
        toast({
          variant: 'destructive',
          title: '시간 초과',
          description: 'AI 처리 시간이 초과되었습니다. 다시 시도해주세요.',
        });
      }, POLL_TIMEOUT_MS);

      intervalRef.current = setInterval(async () => {
        try {
          const job = await API.getAiJobStatus(jobId);

          if (job.status === 'completed') {
            cleanup();
            const result = job.result as { refinedContent: string } | null;
            if (result?.refinedContent) {
              onSuccess(result.refinedContent);
            }
          } else if (job.status === 'failed') {
            cleanup();
            toast({
              variant: 'destructive',
              title: '오류',
              description: job.error || 'AI 정제에 실패했습니다. 다시 시도해주세요.',
            });
          }
        } catch {
          cleanup();
          toast({
            variant: 'destructive',
            title: '오류',
            description: '작업 상태를 확인할 수 없습니다.',
          });
        }
      }, POLL_INTERVAL_MS);
    },
    [cleanup, toast]
  );

  return {
    ...mutation,
    isPolling,
    isPending: mutation.isPending || isPolling,
    startPolling,
    cancelPolling: cleanup,
  };
}
