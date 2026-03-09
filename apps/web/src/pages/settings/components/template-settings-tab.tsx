import { StateRenderer } from '@web/components/state-renderer';
import { useSettings } from '@web/hooks/use-settings';
import { PromptEditor } from './prompt-editor';

export function TemplateSettingsTab() {
  const { data: settings = [], isLoading, error } = useSettings('template');

  return (
    <StateRenderer
      isLoading={isLoading}
      isEmpty={settings.length === 0}
      error={error}
      emptyMessage="템플릿 설정이 없습니다."
    >
      <div className="space-y-4">
        {settings.map((setting) => (
          <PromptEditor key={setting.key} setting={setting} />
        ))}
      </div>
    </StateRenderer>
  );
}
