import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TodoList } from './TodoList';
import { ViewWorkNoteDialog } from '@/pages/WorkNotes/components/ViewWorkNoteDialog';
import { useTodos } from '@/hooks/useTodos';
import { API } from '@/lib/api';
import type { TodoView, Todo } from '@/types/api';

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

        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setSelectedYear(Number(value))}
        >
          <SelectTrigger className="w-[100px] ml-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TodoList
        todos={todos}
        isLoading={isLoading}
        onTodoClick={handleTodoClick}
        groupByWorkNote={currentView !== 'completed'}
      />

      <ViewWorkNoteDialog
        workNote={selectedWorkNote || null}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
