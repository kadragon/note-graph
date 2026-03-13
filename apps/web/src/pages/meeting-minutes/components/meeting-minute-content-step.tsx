import { MarkdownEditor } from '@web/components/markdown-editor';
import { Button } from '@web/components/ui/button';
import { Label } from '@web/components/ui/label';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { MeetingMinuteRefineDialog } from './meeting-minute-refine-dialog';

interface MeetingMinuteContentStepProps {
  detailsRaw: string;
  onDetailsChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
  keywords?: string[];
  meetingId?: string;
}

export function MeetingMinuteContentStep({
  detailsRaw,
  onDetailsChange,
  onBack,
  onSubmit,
  isPending,
  keywords,
  meetingId,
}: MeetingMinuteContentStepProps) {
  const [refineDialogOpen, setRefineDialogOpen] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>회의 내용</Label>
          {meetingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefineDialogOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI 정리 (녹취본)
            </Button>
          )}
        </div>
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

      {meetingId && (
        <MeetingMinuteRefineDialog
          meetingId={meetingId}
          open={refineDialogOpen}
          onOpenChange={setRefineDialogOpen}
          onRefineSuccess={(refinedContent) => onDetailsChange(refinedContent)}
        />
      )}
    </div>
  );
}
