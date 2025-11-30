import { CheckCircle2 } from 'lucide-react';
import type { Todo } from '@/types/api';
import { groupTodosByWorkNote } from './groupTodosByWorkNote';
// Trace: SPEC-todo-1, TASK-046
import { TodoItem } from './TodoItem';

interface TodoListProps {
  todos: Todo[];
  isLoading: boolean;
  onTodoClick?: (todo: Todo) => void;
  groupByWorkNote?: boolean;
}

export function TodoList({
  todos,
  isLoading,
  onTodoClick,
  groupByWorkNote = false,
}: TodoListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">할 일이 없습니다.</p>
      </div>
    );
  }

  if (!groupByWorkNote) {
    return (
      <div className="divide-y">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onTodoClick={onTodoClick} />
        ))}
      </div>
    );
  }

  const groups = groupTodosByWorkNote(todos);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.workNoteId ?? 'no-work'} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">{group.workTitle}</div>
            <span className="text-xs text-muted-foreground">{group.todos.length}개</span>
          </div>
          <div className="divide-y rounded-md border bg-card">
            {group.todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onTodoClick={onTodoClick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
