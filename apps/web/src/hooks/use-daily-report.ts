import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import { qk } from '@web/lib/query-keys';

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: qk.dailyReport(date),
    queryFn: () => API.getDailyReport(date),
    enabled: !!date,
    retry: false,
  });
}

export function useDailyReports(limit = 7) {
  return useQuery({
    queryKey: qk.dailyReports(),
    queryFn: () => API.getDailyReports(limit),
  });
}

export const useGenerateDailyReport = createStandardMutation<
  Awaited<ReturnType<typeof API.generateDailyReport>>,
  string
>({
  mutationFn: (date: string) => API.generateDailyReport(date),
  invalidateKeys: (_data, date) => [qk.dailyReport(date), qk.dailyReports()],
  messages: {
    success: '일일 리포트가 생성되었습니다.',
    error: '리포트 생성에 실패했습니다.',
  },
});
