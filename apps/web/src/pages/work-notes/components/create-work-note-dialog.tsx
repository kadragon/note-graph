// Trace: TASK-024, SPEC-worknote-1

import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useCreateWorkNote } from '@web/hooks/use-work-notes';
import { useState } from 'react';

interface CreateWorkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkNoteDialog({ open, onOpenChange }: CreateWorkNoteDialogProps) {
  const [title, setTitle] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [content, setContent] = useState('');

  const createMutation = useCreateWorkNote();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

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
              <CategorySelector
                categories={taskCategories}
                selectedIds={selectedCategoryIds}
                onSelectionChange={setSelectedCategoryIds}
                isLoading={categoriesLoading}
                idPrefix="create-category"
              />
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
