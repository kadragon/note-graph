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
  { value: 'remaining', label: '남은일' },
  { value: 'completed', label: '완료' },
];

// Generate year options from 2020 to current year + 1
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear - 2020 + 2 },
  (_, i) => 2020 + i
).reverse();

export function TodoTabs() {
  const [currentView, setCurrentView] = useState<TodoView>('today');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedWorkNoteId, setSelectedWorkNoteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: todos = [], isLoading } = useTodos(currentView, selectedYear);

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
      <div className="flex items-center justify-between mb-4">
        <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as TodoView)} className="flex-1">
          <TabsList className="w-full justify-start">
            {TODO_VIEWS.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="ml-4 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year}년
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <TodoList todos={todos} isLoading={isLoading} onTodoClick={handleTodoClick} />
        </CardContent>
      </Card>

      <ViewWorkNoteDialog
        workNote={selectedWorkNote || null}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
