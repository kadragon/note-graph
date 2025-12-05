import { Badge } from '@web/components/ui/badge';
import { Checkbox } from '@web/components/ui/checkbox';
import { TODO_STATUS } from '@web/constants/todoStatus';
import { useToggleTodo } from '@web/hooks/useTodos';
import { cn, formatDateWithYear } from '@web/lib/utils';
import type { RepeatRule, Todo } from '@web/types/api';
import { CalendarDays, Clock, FileText, RefreshCw } from 'lucide-react';

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
  showWorkTitle?: boolean;
}

export function TodoItem({ todo, onTodoClick, showWorkTitle = true }: TodoItemProps) {
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
    <div
      className={cn(
        'flex items-start gap-3 py-3 px-4 rounded-md transition-colors',
        'hover:bg-muted/50',
        isCompleted && 'opacity-60'
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={toggleTodo.isPending}
        className="mt-0.5"
      />
      <button
        type="button"
        className="flex-1 min-w-0 cursor-pointer text-left"
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              'text-sm font-medium leading-tight',
              isCompleted && 'line-through text-muted-foreground'
            )}
          >
            {todo.title}
          </p>
          {showWorkTitle && todo.workCategory && (
            <Badge variant="outline" className="text-xs font-normal">
              {todo.workCategory}
            </Badge>
          )}
          {showWorkTitle && todo.workTitle && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <FileText className="h-3 w-3" />
              {todo.workTitle}
            </Badge>
          )}
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              완료: {formatDateWithYear(todo.updatedAt)}
            </span>
          ) : (
            <>
              {todo.waitUntil && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDateWithYear(todo.waitUntil)} 대기
                </span>
              )}
              {todo.dueDate && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatDateWithYear(todo.dueDate)}
                </span>
              )}
            </>
          )}
          {todo.repeatRule && todo.repeatRule !== 'NONE' && (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <RefreshCw className="h-3 w-3" />
              {getRepeatRuleLabel(todo.repeatRule)}
            </Badge>
          )}
        </div>
      </button>
    </div>
  );
}
