import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import { qk } from '@web/lib/query-keys';
import type { AppSetting } from '@web/types/api';

export function useSettings(category?: string) {
  return useQuery({
    queryKey: qk.settings(category),
    queryFn: () => API.getSettings(category),
  });
}

export const useUpdateSetting = createStandardMutation<AppSetting, { key: string; value: string }>({
  mutationFn: ({ key, value }) => API.updateSetting(key, { value }),
  invalidateKeys: [['settings']],
  messages: {
    success: '설정이 저장되었습니다.',
    error: '설정 저장에 실패했습니다.',
  },
});

export const useResetSetting = createStandardMutation<AppSetting, string>({
  mutationFn: (key) => API.resetSetting(key),
  invalidateKeys: [['settings']],
  messages: {
    success: '기본값으로 초기화되었습니다.',
    error: '초기화에 실패했습니다.',
  },
});

export function useOpenAIModels() {
  return useQuery({
    queryKey: qk.openaiModels(),
    queryFn: () => API.getOpenAIModels(),
    staleTime: 5 * 60 * 1000,
  });
}
