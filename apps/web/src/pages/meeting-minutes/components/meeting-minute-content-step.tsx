import { MarkdownEditor } from '@web/components/markdown-editor';
import { Button } from '@web/components/ui/button';
import { Label } from '@web/components/ui/label';
import { ArrowLeft } from 'lucide-react';

interface MeetingMinuteContentStepProps {
  detailsRaw: string;
  onDetailsChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
  keywords?: string[];
}

export function MeetingMinuteContentStep({
  detailsRaw,
  onDetailsChange,
  onBack,
  onSubmit,
  isPending,
  keywords,
}: MeetingMinuteContentStepProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>회의 내용</Label>
        <MarkdownEditor
          value={detailsRaw}
          onChange={onDetailsChange}
          placeholder="회의 내용을 마크다운으로 작성하세요"
        />
      </div>

      {keywords && keywords.length > 0 && (
        <div className="grid gap-2">
          <Label>키워드</Label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          이전
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isPending}>
          {isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
