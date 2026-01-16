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
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@web/components/ui/popover';
import { STORAGE_KEYS } from '@web/constants/storage';
import { useToast } from '@web/hooks/use-toast';
import {
  downloadWorkNoteFile,
  useDeleteWorkNoteFile,
  useGoogleDriveStatus,
  useMigrateWorkNoteFiles,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import type { WorkNoteFile, WorkNoteFileMigrationResult } from '@web/types/api';
import {
  ArrowRightLeft,
  Cloud,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileIcon,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isUploadedToday, sortFilesByUploadedAtDesc } from './work-note-file-utils';

const GOOGLE_AUTH_URL = '/api/auth/google/authorize';

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
  const [migrationResult, setMigrationResult] = useState<WorkNoteFileMigrationResult | null>(null);
  const [localDrivePath, setLocalDrivePath] = useState('');
  const { toast } = useToast();

  const { data, isLoading } = useWorkNoteFiles(workId);
  const {
    data: driveStatus,
    refetch: refreshDriveStatus,
    isFetching: isDriveChecking,
  } = useGoogleDriveStatus();
  const uploadMutation = useUploadWorkNoteFile();
  const deleteMutation = useDeleteWorkNoteFile();
  const migrateMutation = useMigrateWorkNoteFiles();
  const files = data?.files ?? [];
  const googleDriveConfigured = data?.googleDriveConfigured ?? false;
  const isDriveConnected = driveStatus?.connected ?? false;

  const hasLegacyR2Files = files.some((file) => file.storageType === 'R2');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_DRIVE_PATH);
    if (saved) {
      setLocalDrivePath(saved);
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.LOCAL_DRIVE_PATH && event.newValue) {
        setLocalDrivePath(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLocalDrivePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const path = e.target.value;
    setLocalDrivePath(path);
    localStorage.setItem(STORAGE_KEYS.LOCAL_DRIVE_PATH, path);
  };

  const getLocalFilePath = (file: WorkNoteFile) => {
    if (!localDrivePath) return null;
    const sep = localDrivePath.includes('\\') ? '\\' : '/';
    const cleanPath = localDrivePath.replace(/[/\\]$/, '');
    // Sanitize filename: replace / and \ with _ to avoid path traversal confusion
    const sanitizedName = file.originalName.replace(/[/\\]/g, '_');
    return `${cleanPath}${sep}workNote${sep}${workId}${sep}${sanitizedName}`;
  };

  const copyLocalPath = async (file: WorkNoteFile) => {
    const path = getLocalFilePath(file);
    if (path) {
      try {
        await navigator.clipboard.writeText(path);
        toast({ description: '로컬 경로가 복사되었습니다.' });
      } catch (error) {
        console.error('Failed to copy path:', error);
        toast({
          variant: 'destructive',
          description: '클립보드에 복사할 수 없습니다.',
        });
      }
    }
  };

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
        <div className="flex flex-col items-end gap-1">
          {!isLoading && !googleDriveConfigured && (
            <p className="text-xs text-amber-600">
              Google Drive 설정이 필요합니다. 현재 R2에 있는 기존 파일만 표시됩니다.
            </p>
          )}
          {!isLoading && googleDriveConfigured && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isDriveConnected ? 'ghost' : 'outline'}
                size="sm"
                onClick={async () => {
                  const nextStatus = await refreshDriveStatus();
                  if (!nextStatus.data?.connected) {
                    window.location.href = GOOGLE_AUTH_URL;
                  }
                }}
                disabled={isDriveChecking}
                className={
                  isDriveConnected
                    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                    : 'text-amber-600 border-amber-200 hover:bg-amber-50'
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                연결 상태 확인
              </Button>
              <span
                className={isDriveConnected ? 'text-xs text-emerald-600' : 'text-xs text-amber-600'}
              >
                {isDriveConnected ? 'Google Drive 연결됨' : 'Google Drive 연결 필요'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">로컬 Google Drive 설정</h4>
                  <p className="text-sm text-muted-foreground">
                    로컬 동기화 경로를 설정하면 파일 경로를 쉽게 복사할 수 있습니다.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="local-path">로컬 경로</Label>
                    <Input
                      id="local-path"
                      value={localDrivePath}
                      onChange={handleLocalDrivePathChange}
                      placeholder="예: C:\Users\Name\Google Drive"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {hasLegacyR2Files && (
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
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sortFilesByUploadedAtDesc(files).map((file) => {
            const driveLink = getDriveLink(file);
            const isDriveFile = file.storageType === 'GDRIVE';
            const isR2File = file.storageType === 'R2';
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
                  {isDriveFile && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      <Cloud data-testid="drive-icon" className="h-3 w-3" />
                      Google Drive
                    </span>
                  )}
                  {isR2File && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      <Database className="h-3 w-3" />
                      Cloudflare R2
                    </span>
                  )}
                  {isUploadedToday(file.uploadedAt) && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      오늘 업로드
                    </span>
                  )}
                  {isDriveFile && localDrivePath && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLocalPath(file)}
                      className="h-8 w-8 p-0"
                      title="로컬 경로 복사"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">로컬 경로 복사</span>
                    </Button>
                  )}
                  {driveLink && (
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Google Drive에서 열기"
                    >
                      <a href={driveLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Google Drive에서 열기</span>
                      </a>
                    </Button>
                  )}
                  <div className="flex items-center gap-1">
                    {isPreviewable(file.fileType) && !isDriveFile && (
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
