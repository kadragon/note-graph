// Trace: SPEC-worknote-attachments-1, TASK-057

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@web/components/ui/alert-dialog';
import { Button } from '@web/components/ui/button';
import { Label } from '@web/components/ui/label';
import { useToast } from '@web/hooks/use-toast';
import {
  downloadWorkNoteFile,
  useDeleteWorkNoteFile,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import type { WorkNoteFile } from '@web/types/api';
import { Download, FileIcon, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

interface WorkNoteFileListProps {
  workId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkNoteFileList({ workId }: WorkNoteFileListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [fileToDelete, setFileToDelete] = useState<WorkNoteFile | null>(null);
  const { toast } = useToast();

  const { data: files = [], isLoading } = useWorkNoteFiles(workId);
  const uploadMutation = useUploadWorkNoteFile();
  const deleteMutation = useDeleteWorkNoteFile();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(file);
    uploadMutation.mutate(
      { workId, file },
      {
        onSettled: () => {
          setUploadingFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      }
    );
  };

  const handleDownload = async (file: WorkNoteFile) => {
    try {
      await downloadWorkNoteFile(workId, file.fileId, file.originalName);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: error instanceof Error ? error.message : '파일을 다운로드할 수 없습니다.',
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete) {
      deleteMutation.mutate({ workId, fileId: fileToDelete.fileId });
      setFileToDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">첨부파일</Label>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.hwp,.hwpx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
            disabled={uploadMutation.isPending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadMutation.isPending ? '업로드 중...' : '파일 업로드'}
          </Button>
        </div>
      </div>

      {uploadingFile && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{uploadingFile.name}</p>
            <p className="text-xs text-muted-foreground">
              업로드 중... ({formatFileSize(uploadingFile.size)})
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.fileId}
              className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
            >
              <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)} •{' '}
                  {new Date(file.uploadedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  className="h-8 w-8 p-0"
                  title="다운로드"
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only">다운로드</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFileToDelete(file)}
                  disabled={deleteMutation.isPending}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">삭제</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
