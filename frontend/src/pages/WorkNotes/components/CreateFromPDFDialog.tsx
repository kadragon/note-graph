// Trace: SPEC-ai-draft-refs-1, SPEC-worknote-1, TASK-027, TASK-030
import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AssigneeSelector } from '@/components/AssigneeSelector';
import { FileDropzone } from '@/pages/PDFUpload/components/FileDropzone';
import { useUploadPDF, usePDFJob } from '@/hooks/usePDF';
import { useCreateWorkNote } from '@/hooks/useWorkNotes';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { usePersons } from '@/hooks/usePersons';
import { useToast } from '@/hooks/use-toast';
import type { AIDraftReference } from '@/types/api';

interface CreateFromPDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromPDFDialog({
  open,
  onOpenChange,
}: CreateFromPDFDialogProps) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [references, setReferences] = useState<AIDraftReference[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(
    currentJobId,
    !!currentJobId && uploadMutation.isSuccess
  );
  const createMutation = useCreateWorkNote();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories();
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const { toast } = useToast();

  // Update form when draft is ready (only if user hasn't edited yet)
  useEffect(() => {
    if (job?.status === 'READY' && job.draft && title === '' && content === '') {
      setTitle(job.draft.title);
      setContent(job.draft.content);
      setReferences(job.references || []);
      setSelectedReferenceIds((job.references || []).map((ref) => ref.workId));
      // Try to find matching category
      const matchingCategory = taskCategories.find(
        (cat) => cat.name === job.draft?.category
      );
      if (matchingCategory) {
        setSelectedCategoryIds([matchingCategory.categoryId]);
      }
    }
  }, [job, taskCategories, title, content]);

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '파일 크기는 10MB를 초과할 수 없습니다.',
      });
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

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleReferenceToggle = (workId: string) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(workId)
        ? prev.filter((id) => id !== workId)
        : [...prev, workId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '제목과 내용을 입력해주세요.',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
        relatedWorkIds: selectedReferenceIds.length > 0 ? selectedReferenceIds : undefined,
      });

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const resetForm = () => {
    setCurrentJobId(null);
    setUploadedFile(null);
    setTitle('');
    setSelectedCategoryIds([]);
    setSelectedPersonIds([]);
    setContent('');
    setReferences([]);
    setSelectedReferenceIds([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Add a small delay to allow close animation to complete
      const timer = setTimeout(() => {
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF로 업무노트 만들기
          </DialogTitle>
          <DialogDescription>
            PDF 파일을 업로드하면 AI가 자동으로 업무노트 초안을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Upload PDF */}
          {!job?.draft && (
            <div className="space-y-3">
              <FileDropzone
                onFileSelect={(file) => void handleFileSelect(file)}
                disabled={uploadMutation.isPending || !!currentJobId}
              />

              {uploadedFile && (
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    {job?.status === 'PENDING' || job?.status === 'PROCESSING' ? (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        처리 중
                      </Badge>
                    ) : job?.status === 'ERROR' ? (
                      <Badge variant="destructive">실패</Badge>
                    ) : null}
                  </div>
                  {job?.errorMessage && (
                    <p className="text-sm text-destructive mt-2">{job.errorMessage}</p>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Edit Draft */}
          {job?.status === 'READY' && job.draft && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="업무노트 제목을 입력하세요"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>업무 구분 (선택사항)</Label>
                {categoriesLoading ? (
                  <p className="text-sm text-muted-foreground">로딩 중...</p>
                ) : taskCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    등록된 업무 구분이 없습니다. 먼저 업무 구분을 추가해주세요.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {taskCategories.map((category) => (
                      <div key={category.categoryId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category.categoryId}`}
                          checked={selectedCategoryIds.includes(category.categoryId)}
                          onCheckedChange={() => handleCategoryToggle(category.categoryId)}
                        />
                        <label
                          htmlFor={`category-${category.categoryId}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>담당자 (선택사항)</Label>
                {persons.length === 0 && !personsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    등록된 사람이 없습니다. 먼저 사람을 추가해주세요.
                  </p>
                ) : (
                  <AssigneeSelector
                    persons={persons}
                    selectedPersonIds={selectedPersonIds}
                    onSelectionChange={setSelectedPersonIds}
                    isLoading={personsLoading}
                  />
                )}
              </div>

              {references.length > 0 && (
                <div className="grid gap-2">
                  <Label>AI가 참고한 업무노트</Label>
                  <Card className="p-3 space-y-2">
                    {references.map((ref) => {
                      const isSelected = selectedReferenceIds.includes(ref.workId);
                      const scoreLabel = ref.similarityScore !== undefined
                        ? `${Math.round(ref.similarityScore * 100)}%`
                        : 'N/A';

                      return (
                        <div key={ref.workId} className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleReferenceToggle(ref.workId)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{ref.title}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              <span>연관도 {scoreLabel}</span>
                              {ref.category && <span className="text-muted-foreground">카테고리: {ref.category}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                  <p className="text-xs text-muted-foreground">
                    필요 없는 참고 자료는 선택 해제하세요. 해제된 항목은 저장되지 않습니다.
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="content">내용</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="업무노트 내용을 입력하세요"
                  className="min-h-[300px]"
                  required
                />
              </div>

              {job.draft.todos && job.draft.todos.length > 0 && (
                <div className="grid gap-2">
                  <Label>제안된 할일 (참고용)</Label>
                  <Card className="p-3">
                    <ul className="space-y-2 text-sm">
                      {job.draft.todos.map((todo, idx) => (
                        <li key={`${todo.title}-${idx}`} className="flex items-start">
                          <span className="mr-2">•</span>
                          <div className="flex-1">
                            <div className="font-medium">{todo.title}</div>
                            {todo.description && (
                              <div className="text-muted-foreground text-xs mt-0.5">{todo.description}</div>
                            )}
                            {todo.dueDate && (
                              <div className="text-muted-foreground text-xs mt-0.5">마감: {todo.dueDate}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createMutation.isPending}
                >
                  취소
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? '저장 중...' : '업무노트 저장'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
