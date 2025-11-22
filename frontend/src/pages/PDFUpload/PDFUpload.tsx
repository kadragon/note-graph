import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUploadPDF, usePDFJob, useSavePDFDraft } from '@/hooks/usePDF';
import { FileDropzone } from './components/FileDropzone';

export default function PDFUpload() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(
    currentJobId,
    !!currentJobId && uploadMutation.isSuccess
  );
  const saveDraftMutation = useSavePDFDraft();

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    setUploadedFile(file);
    try {
      const result = await uploadMutation.mutateAsync(file);
      setCurrentJobId(result.jobId);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleSaveDraft = async () => {
    if (!job?.draft) return;

    try {
      await saveDraftMutation.mutateAsync({
        title: job.draft.title,
        category: job.draft.category,
        content: job.draft.content,
      });
      // Reset after save
      setCurrentJobId(null);
      setUploadedFile(null);
    } catch {
      // Error handled by mutation hook
    }
  };

  const getStatusBadge = () => {
    if (!job) return null;

    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive',
    };

    const labels: Record<string, string> = {
      pending: '대기 중',
      processing: '처리 중',
      completed: '완료',
      failed: '실패',
    };

    return (
      <Badge variant={variants[job.status]}>{labels[job.status]}</Badge>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PDF 업로드</h1>
        <p className="text-gray-600 mt-1">PDF 파일에서 업무노트를 생성하세요</p>
      </div>

      <div className="grid gap-6">
        <FileDropzone
          onFileSelect={(file) => void handleFileSelect(file)}
          disabled={uploadMutation.isPending || !!currentJobId}
        />

        {uploadedFile && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>업로드 상태</CardTitle>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">파일명:</span>{' '}
                  {uploadedFile.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">크기:</span>{' '}
                  {(uploadedFile.size / 1024).toFixed(2)} KB
                </p>
                {job?.error && (
                  <p className="text-sm text-destructive">
                    <span className="font-medium">오류:</span> {job.error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {job?.status === 'completed' && job.draft && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>생성된 초안</CardTitle>
                <Button
                  onClick={() => void handleSaveDraft()}
                  disabled={saveDraftMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  업무노트로 저장
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">제목</p>
                <p className="text-sm">{job.draft.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">카테고리</p>
                <Badge variant="secondary">{job.draft.category}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">내용</p>
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {job.draft.content}
                </div>
              </div>
              {job.draft.todos && job.draft.todos.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">제안된 할 일</p>
                  <ul className="space-y-1">
                    {job.draft.todos.map((todo, idx) => (
                      <li key={idx} className="text-sm flex items-start">
                        <span className="mr-2">•</span>
                        <span>{todo.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
