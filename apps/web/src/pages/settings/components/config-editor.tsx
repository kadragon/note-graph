import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Input } from '@web/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import { useSettingEditor } from '@web/hooks/use-setting-editor';
import { useOpenAIModels } from '@web/hooks/use-settings';
import type { AppSetting } from '@web/types/api';
import { RotateCcw, Save } from 'lucide-react';

const ENV_DEFAULT_VALUE = '__env_default__';

interface ConfigEditorProps {
  setting: AppSetting;
}

export function ConfigEditor({ setting }: ConfigEditorProps) {
  const {
    value,
    setValue,
    isModified,
    hasChanges,
    handleSave,
    handleReset,
    isSaving,
    isResetting,
  } = useSettingEditor(setting);
  const { data: models, isLoading: modelsLoading } = useOpenAIModels();

  const isModelSetting = setting.key.startsWith('config.openai_model_');
  const isEmbeddingSetting = setting.key === 'config.openai_model_embedding';

  const filteredModels = models?.filter((m) => {
    if (isEmbeddingSetting) {
      return m.id.includes('embedding');
    }
    return !m.id.includes('embedding');
  });

  // For Select, map empty string to sentinel and back
  const selectValue = value === '' ? ENV_DEFAULT_VALUE : value;
  const handleSelectChange = (v: string) => {
    setValue(v === ENV_DEFAULT_VALUE ? '' : v);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{setting.label}</h3>
          {isModified && (
            <Badge variant="outline" className="text-xs">
              수정됨
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isModified || isResetting}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            초기화
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="h-3 w-3 mr-1" />
            저장
          </Button>
        </div>
      </div>

      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}

      {isModelSetting && !modelsLoading && filteredModels && filteredModels.length > 0 ? (
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="환경변수 기본값 사용" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ENV_DEFAULT_VALUE}>환경변수 기본값 사용</SelectItem>
            {filteredModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="비어있으면 환경변수 기본값 사용"
        />
      )}
    </div>
  );
}
