// Trace: SPEC-todo-2, TASK-052, PR#121 review feedback

import { Badge } from '@web/components/ui/badge';
import { TODO_STATUS } from '@web/constants/todoStatus';
import { formatDateWithYear } from '@web/lib/utils';
import type { Todo, TodoStatus } from '@web/types/api';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { RecurringTodoGroup as RecurringTodoGroupType } from './groupRecurringTodos';
import { TodoListItem } from './TodoListItem';

// Repeat rule to Korean label mapping
const REPEAT_RULE_LABELS: Record<string, string> = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
};

const getRepeatRuleLabel = (repeatRule: string): string => {
  return REPEAT_RULE_LABELS[repeatRule] ?? repeatRule;
};

interface RecurringTodoGroupProps {
  group: RecurringTodoGroupType;
  onToggleTodo: (todoId: string, currentStatus: TodoStatus) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todoId: string) => void;
  togglePending: boolean;
  deletePending: boolean;
}

export function RecurringTodoGroup({
  group,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
  togglePending,
  deletePending,
}: RecurringTodoGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count completed vs total
  const completedCount = group.todos.filter((t) => t.status === TODO_STATUS.COMPLETED).length;
  const totalCount = group.todos.length;

  // Get the next incomplete todo (only show due date if there's an active todo)
  const nextIncompleteTodo = group.todos.find((t) => t.status !== TODO_STATUS.COMPLETED);

  return (
    <div className="border rounded-md">
      {/* Group Header - Collapsed View */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold">{group.title}</p>
            <Badge variant="outline" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              {getRepeatRuleLabel(group.repeatRule)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {totalCount}개 ({completedCount}개 완료)
            </span>
          </div>
          {!isExpanded && nextIncompleteTodo?.dueDate && (
            <p className="text-xs text-muted-foreground mt-1">
              다음 마감: {formatDateWithYear(nextIncompleteTodo.dueDate)}
            </p>
          )}
        </div>
      </button>

      {/* Expanded View - Show all instances */}
      {isExpanded && (
        <div className="border-t divide-y">
          {group.todos.map((todo) => (
            <TodoListItem
              key={todo.id}
              todo={todo}
              onToggle={onToggleTodo}
              onEdit={onEditTodo}
              onDelete={onDeleteTodo}
              togglePending={togglePending}
              deletePending={deletePending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
