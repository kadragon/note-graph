import { Button } from '@web/components/ui/button';
import { Checkbox } from '@web/components/ui/checkbox';
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
import { TODO_STATUS } from '@web/constants/todoStatus';
import { useUpdateTodo } from '@web/hooks/useTodos';
import { toUTCISOString } from '@web/lib/utils';
import type {
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
  Todo,
  TodoStatus,
} from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

interface EditTodoDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workNoteId?: string;
}

// Constants for styling
const SELECT_CLASS_NAME =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

// Options data for dropdowns
const STATUS_OPTIONS: Array<{ value: TodoStatus; label: string }> = [
  { value: TODO_STATUS.IN_PROGRESS, label: TODO_STATUS.IN_PROGRESS },
  { value: TODO_STATUS.COMPLETED, label: TODO_STATUS.COMPLETED },
  { value: TODO_STATUS.ON_HOLD, label: TODO_STATUS.ON_HOLD },
  { value: TODO_STATUS.STOPPED, label: TODO_STATUS.STOPPED },
];

const REPEAT_RULE_OPTIONS: Array<{ value: RepeatRule; label: string }> = [
  { value: 'NONE', label: '반복 안함' },
  { value: 'DAILY', label: '매일' },
  { value: 'WEEKLY', label: '매주' },
  { value: 'MONTHLY', label: '매월' },
  { value: 'CUSTOM', label: '커스텀' },
];

const CUSTOM_UNIT_OPTIONS: Array<{ value: CustomIntervalUnit; label: string }> = [
  { value: 'DAY', label: '일' },
  { value: 'WEEK', label: '주' },
  { value: 'MONTH', label: '개월' },
];

const RECURRENCE_TYPE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'DUE_DATE', label: '마감일 기준' },
  { value: 'COMPLETION_DATE', label: '완료일 기준' },
];

export function EditTodoDialog({ todo, open, onOpenChange, workNoteId }: EditTodoDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [waitUntil, setWaitUntil] = useState('');
  const [status, setStatus] = useState<TodoStatus>(TODO_STATUS.IN_PROGRESS);
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('NONE');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('DUE_DATE');
  const [customInterval, setCustomInterval] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<CustomIntervalUnit>('MONTH');
  const [skipWeekends, setSkipWeekends] = useState(false);

  const updateMutation = useUpdateTodo(workNoteId);

  const handleWaitUntilChange = (value: string) => {
    setWaitUntil(value);
    if (!dueDate && value) {
      setDueDate(value);
    }
  };

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
      setCustomInterval(todo.customInterval || 1);
      setCustomUnit(todo.customUnit || 'MONTH');
      setSkipWeekends(todo.skipWeekends || false);
    }
  }, [todo, open]);

  // Handle status change - clear dates when status is ON_HOLD or STOPPED
  const handleStatusChange = (newStatus: TodoStatus) => {
    setStatus(newStatus);
    if (newStatus === TODO_STATUS.ON_HOLD || newStatus === TODO_STATUS.STOPPED) {
      setDueDate('');
      setWaitUntil('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!todo || !title.trim()) {
      return;
    }

    const effectiveDueDate = dueDate || (waitUntil ? waitUntil : '');

    try {
      await updateMutation.mutateAsync({
        id: todo.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: effectiveDueDate ? toUTCISOString(effectiveDueDate) : undefined,
          waitUntil: waitUntil ? toUTCISOString(waitUntil) : undefined,
          status,
          repeatRule,
          recurrenceType,
          customInterval: repeatRule === 'CUSTOM' ? customInterval : null,
          customUnit: repeatRule === 'CUSTOM' ? customUnit : null,
          skipWeekends,
        },
      });

      onOpenChange(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  if (!todo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>할일 수정</DialogTitle>
            <DialogDescription>할일의 내용을 수정합니다.</DialogDescription>
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
                onChange={(e) => handleStatusChange(e.target.value as TodoStatus)}
                className={SELECT_CLASS_NAME}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="waitUntil">대기일 (선택사항)</Label>
              <Input
                id="waitUntil"
                type="date"
                value={waitUntil}
                onChange={(e) => handleWaitUntilChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">이 날짜까지 대시보드에서 숨겨집니다.</p>
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
              <Label htmlFor="repeatRule">반복 설정</Label>
              <select
                id="repeatRule"
                value={repeatRule}
                onChange={(e) => setRepeatRule(e.target.value as RepeatRule)}
                className={SELECT_CLASS_NAME}
              >
                {REPEAT_RULE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {repeatRule === 'CUSTOM' && (
              <div className="grid gap-2">
                <Label>커스텀 반복 간격</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-20"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as CustomIntervalUnit)}
                    className={SELECT_CLASS_NAME}
                  >
                    {CUSTOM_UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center text-sm text-muted-foreground">마다</span>
                </div>
              </div>
            )}

            {repeatRule !== 'NONE' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipWeekends"
                  checked={skipWeekends}
                  onCheckedChange={(checked) => setSkipWeekends(checked === true)}
                />
                <Label htmlFor="skipWeekends" className="text-sm font-normal cursor-pointer">
                  주말 제외 (토/일요일은 다음 월요일로)
                </Label>
              </div>
            )}

            {repeatRule !== 'NONE' && (
              <div className="grid gap-2">
                <Label htmlFor="recurrenceType">반복 기준</Label>
                <select
                  id="recurrenceType"
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className={SELECT_CLASS_NAME}
                >
                  {RECURRENCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
