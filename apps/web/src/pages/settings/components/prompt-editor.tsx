import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@web/components/ui/collapsible';
import { Textarea } from '@web/components/ui/textarea';
import { useSettingEditor } from '@web/hooks/use-setting-editor';
import type { AppSetting } from '@web/types/api';
import { ChevronDown, RotateCcw, Save } from 'lucide-react';

interface PromptEditorProps {
  setting: AppSetting;
}

export function PromptEditor({ setting }: PromptEditorProps) {
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
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3 w-3" />
            사용 가능한 변수 보기
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
              {setting.description}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[300px] font-mono text-sm"
        placeholder="프롬프트 템플릿을 입력하세요..."
      />
    </div>
  );
}
