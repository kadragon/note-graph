import { Badge } from '@web/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import { useBatchSetDueDates } from '@web/hooks/use-deadline-adjustment';
import { formatDateWithYear } from '@web/lib/utils';
import type { DeadlineSuggestion } from '@web/types/api';
import type { Todo } from '@web/types/models/todo';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface DeadlineAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: DeadlineSuggestion[];
  todos: Todo[];
}

export function DeadlineAdjustmentDialog({
  open,
  onOpenChange,
  suggestions,
  todos,
}: DeadlineAdjustmentDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(suggestions.map((s) => s.todoId))
  );

  const batchSetMutation = useBatchSetDueDates();

  const todoMap = new Map(todos.map((t) => [t.id, t]));

  const enrichedSuggestions = suggestions
    .map((s) => {
      const todo = todoMap.get(s.todoId);
      if (!todo) return null;
      return { ...s, todo };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const allSelected = selectedIds.size === enrichedSuggestions.length;
  const noneSelected = selectedIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(enrichedSuggestions.map((s) => s.todoId)));
    }
  };

  const toggleOne = (todoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(todoId)) {
        next.delete(todoId);
      } else {
        next.add(todoId);
      }
      return next;
    });
  };

  const handleApply = () => {
    const updates = enrichedSuggestions
      .filter((s) => selectedIds.has(s.todoId))
      .map((s) => ({ todoId: s.todoId, dueDate: s.suggestedDueDate }));

    batchSetMutation.mutate(updates, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const dateChanged = (current: string | undefined, suggested: string) => {
    if (!current) return true;
    return current.slice(0, 10) !== suggested.slice(0, 10);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 일정 조정 제안</DialogTitle>
          <DialogDescription>
            AI가 분석한 마감일 조정안입니다. 적용할 항목을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="전체 선택"
                  />
                </TableHead>
                <TableHead>업무노트</TableHead>
                <TableHead>할일</TableHead>
                <TableHead className="w-[260px]">마감일 변경</TableHead>
                <TableHead>사유</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedSuggestions.map((s) => (
                <TableRow key={s.todoId}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(s.todoId)}
                      onCheckedChange={() => toggleOne(s.todoId)}
                      aria-label={`${s.todo.title} 선택`}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="max-w-[150px] truncate" title={s.todo.workTitle}>
                      {s.todo.workTitle || '-'}
                    </div>
                    {s.todo.workCategory && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {s.todo.workCategory}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px]">
                    <div className="truncate" title={s.todo.title}>
                      {s.todo.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">
                        {s.todo.dueDate ? formatDateWithYear(s.todo.dueDate) : '-'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span
                        className={
                          dateChanged(s.todo.dueDate, s.suggestedDueDate)
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatDateWithYear(s.suggestedDueDate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                    <div className="truncate" title={s.reason}>
                      {s.reason}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedIds.size}/{enrichedSuggestions.length}개 선택됨
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleApply} disabled={noneSelected || batchSetMutation.isPending}>
            {batchSetMutation.isPending ? '적용 중...' : '적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
