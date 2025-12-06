// Trace: TASK-LLM-IMPORT

import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useImportPerson, useParsePersonFromText } from '@web/hooks/use-persons';
import type { ParsedPersonData } from '@web/types/api';
import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface PersonImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonImportDialog({ open, onOpenChange }: PersonImportDialogProps) {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedPersonData | null>(null);

  const parsePersonMutation = useParsePersonFromText();
  const importPersonMutation = useImportPerson();

  const handleParse = async () => {
    if (!inputText.trim()) return;

    try {
      const result = await parsePersonMutation.mutateAsync({ text: inputText });
      setParsedData(result);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    try {
      await importPersonMutation.mutateAsync({
        personId: parsedData.personId,
        name: parsedData.name,
        phoneExt: parsedData.phoneExt || undefined,
        currentDept: parsedData.currentDept || undefined,
        currentPosition: parsedData.currentPosition || undefined,
        currentRoleDesc: parsedData.currentRoleDesc || undefined,
        employmentStatus: parsedData.employmentStatus,
      });

      // Reset and close on success
      handleClose();
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleClose = () => {
    setInputText('');
    setParsedData(null);
    onOpenChange(false);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '재직':
        return 'default';
      case '휴직':
        return 'secondary';
      case '퇴직':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            사람 정보 가져오기
          </DialogTitle>
          <DialogDescription>
            사람 정보 텍스트를 붙여넣으면 AI가 자동으로 파싱합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Input Section */}
          <div className="grid gap-2">
            <Label htmlFor="inputText">사람 정보 텍스트</Label>
            <Textarea
              id="inputText"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`예시:
소속	교육대학 > 교무과
이름(번호)	홍길동 (123456)	직책	행정주사
전화번호	043-123-4567	휴대전화	010-1234-5678
이메일	example@example.com
재직상태	재직
담당업무	학사 업무 지원`}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Parse Button */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleParse()}
            disabled={!inputText.trim() || parsePersonMutation.isPending}
          >
            {parsePersonMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                파싱 중...
              </>
            ) : (
              'AI로 파싱하기'
            )}
          </Button>

          {/* Parsed Result Preview */}
          {parsedData && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3 text-sm">파싱 결과</h4>
              <div className="grid gap-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">이름</span>
                  <span className="col-span-2 font-medium">{parsedData.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">사번</span>
                  <span className="col-span-2 font-mono">{parsedData.personId}</span>
                </div>
                {parsedData.phoneExt && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">전화번호</span>
                    <span className="col-span-2">{parsedData.phoneExt}</span>
                  </div>
                )}
                {parsedData.currentDept && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">부서</span>
                    <span className="col-span-2">{parsedData.currentDept}</span>
                  </div>
                )}
                {parsedData.currentPosition && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">직책</span>
                    <span className="col-span-2">{parsedData.currentPosition}</span>
                  </div>
                )}
                {parsedData.currentRoleDesc && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">담당업무</span>
                    <span className="col-span-2">{parsedData.currentRoleDesc}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">재직상태</span>
                  <span className="col-span-2">
                    <Badge variant={getStatusBadgeVariant(parsedData.employmentStatus)}>
                      {parsedData.employmentStatus}
                    </Badge>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={parsePersonMutation.isPending || importPersonMutation.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={!parsedData || importPersonMutation.isPending}
          >
            {importPersonMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
