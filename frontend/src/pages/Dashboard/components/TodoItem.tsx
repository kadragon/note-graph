import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { useToggleTodo } from '@/hooks/useTodos';
import type { Todo } from '@/types/api';
import { cn } from '@/lib/utils';

interface TodoItemProps {
  todo: Todo;
  onTodoClick?: (todo: Todo) => void;
}

export function TodoItem({ todo, onTodoClick }: TodoItemProps) {
  const toggleTodo = useToggleTodo();
  const isCompleted = todo.status === 'completed';

  const handleToggle = () => {
    const newStatus = isCompleted ? 'pending' : 'completed';
    toggleTodo.mutate({ id: todo.id, status: newStatus });
  };

  const handleClick = () => {
    if (onTodoClick) {
      onTodoClick(todo);
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={toggleTodo.isPending}
        className="mt-1"
      />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleClick}>
        <p
          className={cn(
            'text-sm font-medium',
            isCompleted && 'line-through text-gray-400'
          )}
        >
          {todo.title}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          {todo.workTitle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              📝 {todo.workTitle}
            </span>
          )}
          {todo.dueDate && (
            <span>
              📅 {format(parseISO(todo.dueDate), 'M월 d일 (eee)', { locale: ko })}
            </span>
          )}
          {todo.recurrence && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              🔁 {todo.recurrence}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
