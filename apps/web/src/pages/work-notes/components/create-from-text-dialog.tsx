// Trace: SPEC-ai-draft-refs-1, SPEC-worknote-1, TASK-027, TASK-029, TASK-032

import { DraftEditorForm } from '@web/components/draft-editor-form';
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
import { useToast } from '@web/hooks/use-toast';
import { useGenerateDraftWithSimilar } from '@web/hooks/use-ai-draft';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { FileEdit, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CreateFromTextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromTextDialog({ open, onOpenChange }: CreateFromTextDialogProps) {
  const [inputText, setInputText] = useState('');
  const [draftGenerated, setDraftGenerated] = useState(false);

  const generateMutation = useGenerateDraftWithSimilar();
  const { toast } = useToast();

  const { state, actions, data } = useAIDraftForm(() => {
    onOpenChange(false);
  });

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '텍스트를 입력해주세요.',
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        inputText: inputText.trim(),
      });

      actions.populateDraft(result.draft, result.references);
      setDraftGenerated(true);
    } catch {
      // Error handled by mutation hook
    }
  };

  const resetForm = useCallback(() => {
    setInputText('');
    setDraftGenerated(false);
    actions.resetForm();
  }, [actions]);

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            텍스트로 업무노트 만들기
          </DialogTitle>
          <DialogDescription>
            텍스트를 입력하면 AI가 유사한 업무노트를 참고하여 자동으로 초안을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Input Text */}
          {!draftGenerated && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="input-text">업무 내용 입력</Label>
                <Textarea
                  id="input-text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="업무에 대한 내용을 자유롭게 입력하세요. AI가 유사한 업무노트를 참고하여 구조화된 초안을 생성합니다."
                  className="min-h-[200px]"
                  disabled={generateMutation.isPending}
                />
              </div>

              <Button
                onClick={() => void handleGenerate()}
                disabled={generateMutation.isPending || !inputText.trim()}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>처리 중...</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI로 초안 생성
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Edit Draft */}
          {draftGenerated && (
            <DraftEditorForm
              state={state}
              actions={actions}
              data={data}
              onCancel={handleClose}
              onReset={() => setDraftGenerated(false)}
              resetLabel="다시 입력"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
