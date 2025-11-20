import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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
import { useUpdateTodo } from '@/hooks/useTodos';
import { TODO_STATUS } from '@/constants/todoStatus';
import type { Todo, TodoStatus, RepeatRule, RecurrenceType } from '@/types/api';

interface EditTodoDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workNoteId?: string;
}

export function EditTodoDialog({
  todo,
  open,
  onOpenChange,
  workNoteId,
}: EditTodoDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [waitUntil, setWaitUntil] = useState('');
  const [status, setStatus] = useState<TodoStatus>('진행중');
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('NONE');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('DUE_DATE');

  const updateMutation = useUpdateTodo(workNoteId);

  // Initialize form when todo changes
  useEffect(() => {
    if (todo && open) {
      setTitle(todo.title);
      setDescription(todo.description || '');
      setDueDate(todo.dueDate ? format(parseISO(todo.dueDate), 'yyyy-MM-dd') : '');
      setWaitUntil(todo.waitUntil ? format(parseISO(todo.waitUntil), 'yyyy-MM-dd') : '');
      setStatus(todo.status);
      setRepeatRule(todo.repeatRule || 'NONE');
      setRecurrenceType(todo.recurrenceType || 'DUE_DATE');
    }
  }, [todo, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!todo || !title.trim()) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: todo.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          waitUntil: waitUntil ? new Date(waitUntil).toISOString() : undefined,
          status,
          repeatRule,
          recurrenceType,
        },
      });

      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  if (!todo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>할일 수정</DialogTitle>
            <DialogDescription>
              할일의 내용을 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="할일 제목"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">설명 (선택사항)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="상세 설명"
                className="min-h-[80px]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">상태</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value={TODO_STATUS.IN_PROGRESS}>{TODO_STATUS.IN_PROGRESS}</option>
                <option value={TODO_STATUS.COMPLETED}>{TODO_STATUS.COMPLETED}</option>
                <option value={TODO_STATUS.ON_HOLD}>{TODO_STATUS.ON_HOLD}</option>
                <option value={TODO_STATUS.STOPPED}>{TODO_STATUS.STOPPED}</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">마감일 (선택사항)</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="waitUntil">대기일 (선택사항)</Label>
              <Input
                id="waitUntil"
                type="date"
                value={waitUntil}
                onChange={(e) => setWaitUntil(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                이 날짜까지 대시보드에서 숨겨집니다.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="repeatRule">반복 설정</Label>
              <select
                id="repeatRule"
                value={repeatRule}
                onChange={(e) => setRepeatRule(e.target.value as RepeatRule)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="NONE">반복 안함</option>
                <option value="DAILY">매일</option>
                <option value="WEEKLY">매주</option>
                <option value="MONTHLY">매월</option>
              </select>
            </div>

            {repeatRule !== 'NONE' && (
              <div className="grid gap-2">
                <Label htmlFor="recurrenceType">반복 기준</Label>
                <select
                  id="recurrenceType"
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="DUE_DATE">마감일 기준</option>
                  <option value="COMPLETION_DATE">완료일 기준</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {recurrenceType === 'DUE_DATE'
                    ? '다음 할일은 현재 마감일을 기준으로 생성됩니다.'
                    : '다음 할일은 완료한 날짜를 기준으로 생성됩니다.'}
                </p>
              </div>
            )}
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
