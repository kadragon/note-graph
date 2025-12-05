import { useQuery } from '@tanstack/react-query';
import { Calendar, CalendarDays, CalendarRange, ListTodo } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTodos } from '@/hooks/useTodos';
import { API } from '@/lib/api';
import { ViewWorkNoteDialog } from '@/pages/WorkNotes/components/ViewWorkNoteDialog';
import type { Todo, TodoView } from '@/types/api';
import { TodoList } from './TodoList';

const TODO_VIEWS: { value: TodoView; label: string; icon: ReactNode }[] = [
  { value: 'today', label: '오늘', icon: <Calendar className="h-4 w-4" /> },
  { value: 'week', label: '이번 주', icon: <CalendarDays className="h-4 w-4" /> },
  { value: 'month', label: '이번 달', icon: <CalendarRange className="h-4 w-4" /> },
  { value: 'remaining', label: '남은일', icon: <ListTodo className="h-4 w-4" /> },
];

export function TodoTabs() {
  const [currentView, setCurrentView] = useState<TodoView>('today');
  const [selectedWorkNoteId, setSelectedWorkNoteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: todos = [], isLoading } = useTodos(currentView);

  // Fetch work note when a todo is clicked
  const { data: selectedWorkNote } = useQuery({
    queryKey: ['work-note', selectedWorkNoteId],
    queryFn: () =>
      selectedWorkNoteId ? API.getWorkNote(selectedWorkNoteId) : Promise.resolve(null),
    enabled: !!selectedWorkNoteId,
  });

  const handleTodoClick = (todo: Todo) => {
    if (todo.workNoteId) {
      setSelectedWorkNoteId(todo.workNoteId);
      setIsDialogOpen(true);
    }
  };

  return (
    <>
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
      </div>

      <TodoList
        todos={todos}
        isLoading={isLoading}
        onTodoClick={handleTodoClick}
        groupByWorkNote={true}
      />

      <ViewWorkNoteDialog
        workNote={selectedWorkNote || null}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
