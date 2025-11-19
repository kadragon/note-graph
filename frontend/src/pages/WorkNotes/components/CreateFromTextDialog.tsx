// Trace: TASK-027, SPEC-worknote-1
import { useState, useEffect } from 'react';
import { FileEdit, Sparkles } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { AssigneeSelector } from '@/components/AssigneeSelector';
import { useGenerateDraftWithSimilar } from '@/hooks/useAIDraft';
import { useCreateWorkNote } from '@/hooks/useWorkNotes';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { usePersons } from '@/hooks/usePersons';
import { useToast } from '@/hooks/use-toast';
import type { AIDraftTodo } from '@/types/api';

interface CreateFromTextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromTextDialog({
  open,
  onOpenChange,
}: CreateFromTextDialogProps) {
  const [inputText, setInputText] = useState('');
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [suggestedTodos, setSuggestedTodos] = useState<AIDraftTodo[]>([]);

  const generateMutation = useGenerateDraftWithSimilar();
  const createMutation = useCreateWorkNote();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories();
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '텍스트를 입력해주세요.',
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        inputText: inputText.trim(),
      });

      setTitle(result.title);
      setContent(result.content);
      setSuggestedTodos(result.todos || []);

      // Try to find matching category
      const matchingCategory = taskCategories.find(
        (cat) => cat.name === result.category
      );
      if (matchingCategory) {
        setSelectedCategoryIds([matchingCategory.categoryId]);
      }

      setDraftGenerated(true);
    } catch (error) {
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

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
      });

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const resetForm = () => {
    setInputText('');
    setDraftGenerated(false);
    setTitle('');
    setSelectedCategoryIds([]);
    setSelectedPersonIds([]);
    setContent('');
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
            <FileEdit className="h-5 w-5" />
            텍스트로 업무노트 만들기
          </DialogTitle>
          <DialogDescription>
            텍스트를 입력하면 AI가 유사한 업무노트를 참고하여 자동으로 초안을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Input Text */}
          {!draftGenerated && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="input-text">업무 내용 입력</Label>
                <Textarea
                  id="input-text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="업무에 대한 내용을 자유롭게 입력하세요. AI가 유사한 업무노트를 참고하여 구조화된 초안을 생성합니다."
                  className="min-h-[200px]"
                  disabled={generateMutation.isPending}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !inputText.trim()}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>처리 중...</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI로 초안 생성
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Edit Draft */}
          {draftGenerated && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label>제안된 할일 (참고용)</Label>
                  <Card className="p-3">
                    <ul className="space-y-2 text-sm">
                      {suggestedTodos.map((todo, idx) => (
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

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraftGenerated(false)}
                  disabled={createMutation.isPending}
                >
                  다시 입력
                </Button>
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
