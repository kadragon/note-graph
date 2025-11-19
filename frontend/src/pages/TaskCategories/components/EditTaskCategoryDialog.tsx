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
import { useUpdateTaskCategory } from '@/hooks/useTaskCategories';
import type { TaskCategory } from '@/types/api';

interface EditTaskCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: TaskCategory | null;
}

export function EditTaskCategoryDialog({
  open,
  onOpenChange,
  category,
}: EditTaskCategoryDialogProps) {
  const [name, setName] = useState(category?.name || '');
  const updateMutation = useUpdateTaskCategory();

  // Update local state when category changes
  if (category && name !== category.name && !updateMutation.isPending) {
    setName(category.name);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !name.trim()) return;

    updateMutation.mutate(
      {
        categoryId: category.categoryId,
        data: { name: name.trim() },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>업무 구분 수정</DialogTitle>
            <DialogDescription>
              업무 구분을 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">업무 구분</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: KORUS, 수업/성적, 등록, 장학"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
