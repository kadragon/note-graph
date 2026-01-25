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
  useGoogleDriveStatus,
  useMigrateWorkNoteFiles,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import type { DriveFileListItem, WorkNoteFileMigrationResult } from '@web/types/api';
import { ArrowRightLeft, ExternalLink, FileIcon, FolderOpen, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { isModifiedToday, sortFilesByModifiedTimeDesc } from './work-note-file-utils';

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
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [fileToDelete, setFileToDelete] = useState<DriveFileListItem | null>(null);
  const [migrationResult, setMigrationResult] = useState<WorkNoteFileMigrationResult | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useWorkNoteFiles(workId);
  const { data: driveStatus } = useGoogleDriveStatus();
  const uploadMutation = useUploadWorkNoteFile();
  const deleteMutation = useDeleteWorkNoteFile();
  const migrateMutation = useMigrateWorkNoteFiles();

  const files = data?.files ?? [];
  const driveFolderLink = data?.driveFolderLink ?? null;
  const googleDriveConfigured = data?.googleDriveConfigured ?? false;
  const hasLegacyFiles = data?.hasLegacyFiles ?? false;
  const isDriveConnected = driveStatus?.connected ?? false;
  const isUploadDisabled = uploadingFiles.length > 0 || !googleDriveConfigured;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (!isDriveConnected && googleDriveConfigured) {
      toast({
        variant: 'destructive',
        title: 'Google Drive 연결 필요',
        description: '파일을 업로드하려면 Google Drive 연결이 필요합니다.',
      });
      return;
    }

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

  const handleDownload = (file: DriveFileListItem) => {
    const link = downloadWorkNoteFile(file);
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete) {
      // Use Drive file ID directly (not FILE- prefixed)
      deleteMutation.mutate({ workId, fileId: fileToDelete.id });
      setFileToDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">첨부파일</Label>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {driveFolderLink && (
              <Button asChild type="button" variant="outline" size="sm">
                <a href={driveFolderLink} target="_blank" rel="noopener noreferrer">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Drive 폴더 열기
                </a>
              </Button>
            )}
            {hasLegacyFiles && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  migrateMutation.mutate(workId, {
                    onSuccess: (result) => setMigrationResult(result),
                  })
                }
                disabled={migrateMutation.isPending}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {migrateMutation.isPending
                  ? 'Google Drive로 옮기는 중...'
                  : 'R2 파일 Google Drive로 옮기기'}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.hwp,.hwpx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              disabled={isUploadDisabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadDisabled}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingFiles.length > 0 ? '업로드 중...' : '파일 업로드'}
            </Button>
          </div>
          {migrateMutation.isPending && (
            <p className="text-xs text-muted-foreground">마이그레이션 진행 중...</p>
          )}
          {!migrateMutation.isPending && migrationResult && (
            <p className="text-xs text-muted-foreground">
              마이그레이션 결과: 이동 {migrationResult.migrated}개 · 건너뜀{' '}
              {migrationResult.skipped}개 · 실패 {migrationResult.failed}개
            </p>
          )}
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
      ) : files.length === 0 && hasLegacyFiles ? (
        <p className="text-sm text-muted-foreground">
          R2에 저장된 기존 파일이 있습니다. 위의 버튼으로 Google Drive로 옮겨주세요.
        </p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sortFilesByModifiedTimeDesc(files).map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
            >
              <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium truncate hover:underline block"
                >
                  {file.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)} •{' '}
                  {new Date(file.modifiedTime).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isModifiedToday(file.modifiedTime) && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    오늘 수정
                  </span>
                )}
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Google Drive에서 열기"
                >
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Google Drive에서 열기</span>
                  </a>
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    className="h-8 w-8 p-0"
                    title="Drive에서 열기"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Drive에서 열기</span>
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
