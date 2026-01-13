// Trace: SPEC-worknote-attachments-1, TASK-063, TASK-066

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
import { API } from '@web/lib/api';
import type { WorkNoteFile } from '@web/types/api';
import { Cloud, Download, ExternalLink, Eye, FileIcon, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { isUploadedToday, sortFilesByUploadedAtDesc } from './work-note-file-utils';

interface WorkNoteFileListProps {
  workId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/**
 * Check if file can be previewed in browser (PDF and images only)
 */
function isPreviewable(fileType: string): boolean {
  return PREVIEWABLE_TYPES.has(fileType.toLowerCase());
}

function getDriveLink(file: WorkNoteFile): string | null {
  if (file.storageType !== 'GDRIVE') return null;
  return file.gdriveWebViewLink ?? null;
}

export function WorkNoteFileList({ workId }: WorkNoteFileListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [fileToDelete, setFileToDelete] = useState<WorkNoteFile | null>(null);
  const { toast } = useToast();

  const { data: files = [], isLoading } = useWorkNoteFiles(workId);
  const uploadMutation = useUploadWorkNoteFile();
  const deleteMutation = useDeleteWorkNoteFile();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesArray = Array.from(selectedFiles);
    setUploadingFiles(filesArray);

    // 순차적으로 파일 업로드
    for (const file of filesArray) {
      await new Promise<void>((resolve) => {
        uploadMutation.mutate(
          { workId, file },
          {
            onSettled: () => {
              setUploadingFiles((prev) => prev.filter((f) => f !== file));
              resolve();
            },
          }
        );
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (file: WorkNoteFile) => {
    try {
      const driveLink = await downloadWorkNoteFile(workId, file);
      if (driveLink) {
        window.open(driveLink, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: error instanceof Error ? error.message : '파일을 다운로드할 수 없습니다.',
      });
    }
  };

  const handlePreview = (file: WorkNoteFile) => {
    const viewUrl = API.getWorkNoteFileViewUrl(workId, file.fileId);
    window.open(viewUrl, '_blank', 'noopener,noreferrer');
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
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.hwp,.hwpx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
            disabled={uploadingFiles.length > 0}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.length > 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadingFiles.length > 0 ? '업로드 중...' : '파일 업로드'}
          </Button>
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file, index) => (
            <div
              key={`uploading-${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted p-3"
            >
              <FileIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  업로드 중... ({formatFileSize(file.size)})
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sortFilesByUploadedAtDesc(files).map((file) => {
            const driveLink = getDriveLink(file);
            return (
              <div
                key={file.fileId}
                className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {driveLink ? (
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate hover:underline"
                    >
                      {file.originalName}
                    </a>
                  ) : (
                    <p className="text-sm font-medium truncate">{file.originalName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)} •{' '}
                    {new Date(file.uploadedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {driveLink && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      <Cloud data-testid="drive-icon" className="h-3 w-3" />
                      Google Drive
                    </span>
                  )}
                  {isUploadedToday(file.uploadedAt) && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      오늘 업로드
                    </span>
                  )}
                  {driveLink && (
                    <Button asChild type="button" variant="outline" size="sm" className="h-8 px-2">
                      <a href={driveLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Google Drive에서 열기
                      </a>
                    </Button>
                  )}
                  <div className="flex items-center gap-1">
                    {isPreviewable(file.fileType) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(file)}
                        className="h-8 w-8 p-0"
                        title="바로보기"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">바로보기</span>
                      </Button>
                    )}
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
              </div>
            );
          })}
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
