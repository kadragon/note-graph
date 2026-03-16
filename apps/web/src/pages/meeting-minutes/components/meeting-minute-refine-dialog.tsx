import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useRefineMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface MeetingMinuteRefineDialogProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefineSuccess: (refinedContent: string) => void;
}

export function MeetingMinuteRefineDialog({
  meetingId,
  open,
  onOpenChange,
  onRefineSuccess,
}: MeetingMinuteRefineDialogProps) {
  const [transcript, setTranscript] = useState('');
  const { mutateAsync, isPending, isPolling, startPolling, cancelPolling } =
    useRefineMeetingMinute();

  const handleRefine = () => {
    mutateAsync({
      meetingId,
      transcript: transcript.trim(),
    })
      .then((result) => {
        startPolling(result.jobId, (refinedContent) => {
          onRefineSuccess(refinedContent);
          onOpenChange(false);
        });
      })
      .catch(() => {
        // onError in the mutation hook already shows a toast
      });
  };

  const resetForm = useCallback(() => {
    setTranscript('');
    cancelPolling();
  }, [cancelPolling]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI 회의록 정리 (녹취본)
          </DialogTitle>
          <DialogDescription>
            녹취본(전사본)을 붙여넣으면 AI가 기존 회의록과 대조하여 누락된 내용을 보완하고 부정확한
            부분을 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="transcript">녹취본</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="회의 녹취본(전사본)을 붙여넣으세요"
              className="min-h-[200px]"
              disabled={isPending}
            />
          </div>

          {isPolling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 회의록을 분석하고 있습니다...
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              취소
            </Button>
            <Button onClick={() => void handleRefine()} disabled={isPending || !transcript.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI 정리
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
