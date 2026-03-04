import { StateRenderer } from '@web/components/state-renderer';
import { useSettings } from '@web/hooks/use-settings';
import { ConfigEditor } from './config-editor';

export function ConfigSettingsTab() {
  const { data: settings = [], isLoading, error } = useSettings('config');

  return (
    <StateRenderer
      isLoading={isLoading}
      isEmpty={settings.length === 0}
      error={error}
      emptyMessage="환경 설정이 없습니다."
    >
      <div className="space-y-4">
        {settings.map((setting) => (
          <ConfigEditor key={setting.key} setting={setting} />
        ))}
      </div>
    </StateRenderer>
  );
}
