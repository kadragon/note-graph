import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { TodoList } from './TodoList';
import { useTodos } from '@/hooks/useTodos';
import type { TodoView } from '@/types/api';

const TODO_VIEWS: { value: TodoView; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'backlog', label: '백로그' },
  { value: 'all', label: '전체' },
];

export function TodoTabs() {
  const [currentView, setCurrentView] = useState<TodoView>('today');
  const { data: todos = [], isLoading } = useTodos(currentView);

  return (
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
              <TodoList todos={todos} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
