import { Tabs, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { useTodos } from '@web/hooks/use-todos';
import type { Todo, TodoView } from '@web/types/api';
import { Calendar, CalendarDays, CalendarRange, ListTodo } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TodoList } from './todo-list';

const TODO_VIEWS: { value: TodoView; label: string; icon: ReactNode }[] = [
  { value: 'today', label: '오늘', icon: <Calendar className="h-4 w-4" aria-hidden="true" /> },
  {
    value: 'week',
    label: '이번 주',
    icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'month',
    label: '이번 달',
    icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'remaining',
    label: '남은일',
    icon: <ListTodo className="h-4 w-4" aria-hidden="true" />,
  },
];

export function TodoTabs() {
  const [currentView, setCurrentView] = useState<TodoView>('today');
  const navigate = useNavigate();

  const { data: todos = [], isLoading } = useTodos(currentView);

  const handleTodoClick = (todo: Todo) => {
    if (todo.workNoteId) {
      navigate(`/work-notes/${todo.workNoteId}`);
    }
  };

  return (
    <div className="mb-4">
      <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as TodoView)}>
        <TabsList className="w-full justify-start">
          {TODO_VIEWS.map((view) => (
            <TabsTrigger key={view.value} value={view.value} className="gap-2">
              {view.icon}
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <TodoList
        todos={todos}
        isLoading={isLoading}
        onTodoClick={handleTodoClick}
        groupByWorkNote={true}
      />
    </div>
  );
}
