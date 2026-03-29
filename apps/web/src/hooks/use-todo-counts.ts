import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { qk } from '@web/lib/query-keys';

export function useTodoCountsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: qk.todoCountsByDateRange(startDate, endDate),
    queryFn: () => API.getTodoCountsByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}
