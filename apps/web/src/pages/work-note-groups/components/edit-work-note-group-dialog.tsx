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
import { useUpdateWorkNoteGroup } from '@web/hooks/use-work-note-groups';
import type { WorkNoteGroup } from '@web/types/api';
import { useEffect, useState } from 'react';

interface EditWorkNoteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: WorkNoteGroup | null | undefined;
}

export function EditWorkNoteGroupDialog({
  open,
  onOpenChange,
  group,
}: EditWorkNoteGroupDialogProps) {
  const [name, setName] = useState('');
  const updateMutation = useUpdateWorkNoteGroup();

  useEffect(() => {
    if (group && open) {
      setName(group.name);
    }
  }, [group, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!group || !name.trim()) return;

    updateMutation.mutate(
      {
        groupId: group.groupId,
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
            <DialogTitle>업무 그룹 수정</DialogTitle>
            <DialogDescription>업무 그룹을 수정합니다.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">업무 그룹</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 프로젝트 A, 위원회 업무"
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
