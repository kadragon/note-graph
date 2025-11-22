import { CalendarDays, RefreshCw, FileText, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToggleTodo } from '@/hooks/useTodos';
import type { Todo, RepeatRule } from '@/types/api';
import { cn, formatDateWithYear } from '@/lib/utils';
import { TODO_STATUS } from '@/constants/todoStatus';

// Repeat rule to Korean label mapping
const REPEAT_RULE_LABELS: Partial<Record<RepeatRule, string>> = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
};

const getRepeatRuleLabel = (repeatRule: RepeatRule): string => {
  return REPEAT_RULE_LABELS[repeatRule] ?? '';
};

interface TodoItemProps {
  todo: Todo;
  onTodoClick?: (todo: Todo) => void;
}

export function TodoItem({ todo, onTodoClick }: TodoItemProps) {
  const toggleTodo = useToggleTodo();
  const isCompleted = todo.status === TODO_STATUS.COMPLETED;

  const handleToggle = () => {
    const newStatus = isCompleted ? TODO_STATUS.IN_PROGRESS : TODO_STATUS.COMPLETED;
    toggleTodo.mutate({ id: todo.id, status: newStatus });
  };

  const handleClick = () => {
    if (onTodoClick) {
      onTodoClick(todo);
    }
  };

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 px-4 rounded-md transition-colors',
      'hover:bg-muted/50',
      isCompleted && 'opacity-60'
    )}>
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={toggleTodo.isPending}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleClick}>
        <p
          className={cn(
            'text-sm font-medium leading-tight',
            isCompleted && 'line-through text-muted-foreground'
          )}
        >
          {todo.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {todo.workTitle && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <FileText className="h-3 w-3" />
              {todo.workTitle}
            </Badge>
          )}
          {todo.dueDate && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatDateWithYear(todo.dueDate)}
            </span>
          )}
          {todo.waitUntil && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDateWithYear(todo.waitUntil)} 대기
            </span>
          )}
          {todo.repeatRule && todo.repeatRule !== 'NONE' && (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <RefreshCw className="h-3 w-3" />
              {getRepeatRuleLabel(todo.repeatRule)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
