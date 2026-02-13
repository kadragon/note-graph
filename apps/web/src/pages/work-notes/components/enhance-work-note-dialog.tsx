// Trace: TASK-D.1

import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useEnhanceWorkNote } from '@web/hooks/use-enhance-work-note';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { FILE_UPLOAD_CONFIG } from '@web/lib/config';
import type { EnhanceWorkNoteResponse } from '@web/types/api';
import { Paperclip, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface EnhanceWorkNoteDialogProps {
  workId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnhanceSuccess: (response: EnhanceWorkNoteResponse) => void;
}

function isPdfFile(file: File): boolean {
  const mimeType = file.type.trim().toLowerCase();
  const fileName = file.name.toLowerCase();
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
}

export function EnhanceWorkNoteDialog({
  workId,
  open,
  onOpenChange,
  onEnhanceSuccess,
}: EnhanceWorkNoteDialogProps) {
  const [newContent, setNewContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enhanceMutation = useEnhanceWorkNote();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!newContent.trim() && !selectedFile) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '추가할 내용을 입력하거나 파일을 첨부해주세요.',
      });
      return;
    }

    try {
      const result = await enhanceMutation.mutateAsync({
        workId,
        newContent: newContent.trim(),
        generateNewTodos: true,
        file: selectedFile || undefined,
      });

      onEnhanceSuccess(result);

      if (selectedFile && isPdfFile(selectedFile)) {
        void API.uploadWorkNoteFile(workId, selectedFile).catch((error) => {
          console.error('PDF attachment upload failed:', error);
          toast({
            variant: 'destructive',
            title: '주의',
            description: 'PDF 첨부에 실패했습니다. 업무노트 업데이트는 유지되었습니다.',
          });
        });
      }
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
        toast({
          variant: 'destructive',
          title: '오류',
          description: `파일 크기는 ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다.`,
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = useCallback(() => {
    setNewContent('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI로 업무노트 업데이트
          </DialogTitle>
          <DialogDescription>
            새로운 정보를 입력하면 AI가 기존 내용과 병합하여 업무노트를 향상시킵니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="new-content">추가할 내용</Label>
            <Textarea
              id="new-content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="업무노트에 추가할 새로운 정보를 입력하세요. 텍스트 또는 파일을 통해 정보를 제공할 수 있습니다."
              className="min-h-[150px]"
              disabled={enhanceMutation.isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label>파일 첨부 (선택사항)</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={enhanceMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={enhanceMutation.isPending}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                파일 첨부
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleRemoveFile}
                    disabled={enhanceMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, TXT, MD 파일 지원 (최대 {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB)
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={enhanceMutation.isPending}
            >
              취소
            </Button>
            <Button
              onClick={() => void handleGenerate()}
              disabled={enhanceMutation.isPending || (!newContent.trim() && !selectedFile)}
            >
              {enhanceMutation.isPending ? (
                '처리 중...'
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI로 생성
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
