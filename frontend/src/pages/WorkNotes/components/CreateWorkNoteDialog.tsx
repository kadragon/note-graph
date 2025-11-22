// Trace: TASK-024, SPEC-worknote-1
import { useState } from 'react';
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
import { AssigneeSelector } from '@/components/AssigneeSelector';
import { useCreateWorkNote } from '@/hooks/useWorkNotes';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { usePersons } from '@/hooks/usePersons';

interface CreateWorkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkNoteDialog({
  open,
  onOpenChange,
}: CreateWorkNoteDialogProps) {
  const [title, setTitle] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [content, setContent] = useState('');

  const createMutation = useCreateWorkNote();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories();
  const { data: persons = [], isLoading: personsLoading } = usePersons();

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
      setTitle('');
      setSelectedCategoryIds([]);
      setSelectedPersonIds([]);
      setContent('');
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>새 업무노트 작성</DialogTitle>
            <DialogDescription>
              새로운 업무노트를 작성합니다. 모든 필드를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
                className="min-h-[200px]"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
