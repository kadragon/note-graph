// Trace: SPEC-ai-draft-refs-1, SPEC-worknote-1, TASK-027, TASK-030
import { useState, useEffect } from 'react';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { AIReferenceList } from '@/components/AIReferenceList';
import { FileDropzone } from '@/pages/PDFUpload/components/FileDropzone';
import { useUploadPDF, usePDFJob } from '@/hooks/usePDF';
import { useCreateWorkNote } from '@/hooks/useWorkNotes';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { usePersons } from '@/hooks/usePersons';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api';
import type { AIDraftReference, AIDraftTodo } from '@/types/api';

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
  const [suggestedTodos, setSuggestedTodos] = useState<AIDraftTodo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(
    currentJobId,
    !!currentJobId && uploadMutation.isSuccess
  );
  const createMutation = useCreateWorkNote();
  const queryClient = useQueryClient();
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
      setSuggestedTodos(job.draft.todos || []);
      // Try to find matching category
      const matchingCategory = taskCategories.find(
        (cat) => cat.name === job.draft?.category
      );
      if (matchingCategory) {
        setSelectedCategoryIds([matchingCategory.categoryId]);
      }
    }
  }, [job, taskCategories, title, content]);

  const handleRemoveTodo = (index: number) => {
    setSuggestedTodos((prev) => prev.filter((_, i) => i !== index));
  };

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

    setIsSubmitting(true);

    try {
      // Create work note first
      const workNote = await API.createWorkNote({
        title: title.trim(),
        content: content.trim(),
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
        relatedWorkIds: selectedReferenceIds.length > 0 ? selectedReferenceIds : undefined,
      });

      // Validate that work note was created with an ID
      if (!workNote?.id) {
        throw new Error('업무노트 생성에 실패했거나, 서버에서 잘못된 데이터를 반환했습니다.');
      }

      // Create todos if any suggested todos exist
      if (suggestedTodos.length > 0) {
        const todoPromises = suggestedTodos.map((todo) =>
          API.createWorkNoteTodo(workNote.id, {
            title: todo.title,
            description: todo.description,
            dueDate: todo.dueDate,
            repeatRule: 'NONE',
          })
        );

        await Promise.all(todoPromises);

        // Invalidate todos query when todos are created
        void queryClient.invalidateQueries({ queryKey: ['todos'] });

        toast({
          title: '성공',
          description: `업무노트와 ${suggestedTodos.length}개의 할일이 저장되었습니다.`,
        });
      } else {
        toast({
          title: '성공',
          description: '업무노트가 생성되었습니다.',
        });
      }

      // Always invalidate work-notes queries
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
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
    setSuggestedTodos([]);
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

              <AIReferenceList
                references={references}
                selectedIds={selectedReferenceIds}
                onSelectionChange={setSelectedReferenceIds}
              />

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

              {suggestedTodos.length > 0 && (
                <div className="grid gap-2">
                  <Label>생성될 할일 (삭제 가능)</Label>
                  <Card className="p-3">
                    <ul className="space-y-2 text-sm">
                      {suggestedTodos.map((todo, idx) => (
                        <li key={`${todo.title}-${idx}`} className="flex items-start group">
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveTodo(idx)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
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
                  disabled={isSubmitting}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '저장 중...' : '업무노트 저장'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
