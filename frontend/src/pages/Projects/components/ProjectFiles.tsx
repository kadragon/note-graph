// Trace: SPEC-project-1, TASK-043
import { useState, useCallback } from 'react';
import { Upload, Download, Trash2, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectFiles, useUploadProjectFile, useDeleteProjectFile } from '@/hooks/useProjects';
import { API } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ProjectFilesProps {
  projectId: string;
}

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  const [isDragging, setIsDragging] = useState(false);

  const { data: files = [] } = useProjectFiles(projectId);
  const uploadMutation = useUploadProjectFile();
  const deleteMutation = useDeleteProjectFile();

  const handleFileUpload = async (file: File) => {
    try {
      await uploadMutation.mutateAsync({ projectId, file });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
    e.target.value = ''; // Reset input
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  }, [projectId]);

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const blob = await API.downloadProjectFile(projectId, fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return;

    try {
      await deleteMutation.mutateAsync({ projectId, fileId });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>파일</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          `}
        >
          <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            파일을 드래그하거나 클릭하여 업로드하세요
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            최대 50MB (PDF, 이미지, Office 문서)
          </p>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor="file-upload" className="cursor-pointer">
              파일 선택
            </label>
          </Button>
        </div>

        {/* Files List */}
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            업로드된 파일이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>파일명</TableHead>
                <TableHead>크기</TableHead>
                <TableHead>업로드일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.fileId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      {file.originalName}
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(file.uploadedAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDownload(file.fileId, file.originalName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(file.fileId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
