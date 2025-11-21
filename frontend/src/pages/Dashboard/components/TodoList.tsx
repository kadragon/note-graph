import { CheckCircle2 } from 'lucide-react';
import { TodoItem } from './TodoItem';
import type { Todo } from '@/types/api';

interface TodoListProps {
  todos: Todo[];
  isLoading: boolean;
  onTodoClick?: (todo: Todo) => void;
}

export function TodoList({ todos, isLoading, onTodoClick }: TodoListProps) {
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

  return (
    <div className="divide-y">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onTodoClick={onTodoClick} />
      ))}
    </div>
  );
}
