import type { AppSetting } from '@web/types/api';
import { useEffect, useState } from 'react';

import { useResetSetting, useUpdateSetting } from './use-settings';

export function useSettingEditor(setting: AppSetting) {
  const [value, setValue] = useState(setting.value);
  const updateMutation = useUpdateSetting();
  const resetMutation = useResetSetting();
  const isModified = value !== setting.defaultValue;
  const hasChanges = value !== setting.value;

  useEffect(() => {
    setValue(setting.value);
  }, [setting.value]);

  const handleSave = () => {
    updateMutation.mutate({ key: setting.key, value });
  };

  const handleReset = () => {
    resetMutation.mutate(setting.key);
  };

  return {
    value,
    setValue,
    isModified,
    hasChanges,
    handleSave,
    handleReset,
    isSaving: updateMutation.isPending,
    isResetting: resetMutation.isPending,
  };
}
