import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateTaskCategory } from '@/hooks/useTaskCategories';

interface CreateTaskCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskCategoryDialog({ open, onOpenChange }: CreateTaskCategoryDialogProps) {
  const [name, setName] = useState('');
  const createMutation = useCreateTaskCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    createMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('');
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
            <DialogTitle>새 업무 구분 추가</DialogTitle>
            <DialogDescription>새로운 업무 구분을 추가합니다.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">업무 구분</Label>
              <Input
                id="name"
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
