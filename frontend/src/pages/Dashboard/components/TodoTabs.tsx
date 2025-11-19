import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { TodoList } from './TodoList';
import { ViewWorkNoteDialog } from '@/pages/WorkNotes/components/ViewWorkNoteDialog';
import { useTodos } from '@/hooks/useTodos';
import { API } from '@/lib/api';
import type { TodoView, Todo, WorkNote } from '@/types/api';

const TODO_VIEWS: { value: TodoView; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'backlog', label: '백로그' },
  { value: 'all', label: '전체' },
];

export function TodoTabs() {
  const [currentView, setCurrentView] = useState<TodoView>('today');
  const [selectedWorkNoteId, setSelectedWorkNoteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: todos = [], isLoading } = useTodos(currentView);

  // Fetch work note when a todo is clicked
  const { data: selectedWorkNote } = useQuery({
    queryKey: ['work-note', selectedWorkNoteId],
    queryFn: () => (selectedWorkNoteId ? API.getWorkNote(selectedWorkNoteId) : Promise.resolve(null)),
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
      <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as TodoView)}>
        <TabsList className="w-full justify-start">
          {TODO_VIEWS.map((view) => (
            <TabsTrigger key={view.value} value={view.value}>
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TODO_VIEWS.map((view) => (
          <TabsContent key={view.value} value={view.value}>
            <Card>
              <CardContent className="p-0">
                <TodoList todos={todos} isLoading={isLoading} onTodoClick={handleTodoClick} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ViewWorkNoteDialog
        workNote={selectedWorkNote || null}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
