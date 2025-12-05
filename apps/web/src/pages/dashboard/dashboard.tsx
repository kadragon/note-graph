import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { CheckSquare } from 'lucide-react';
import { TodoTabs } from './components/todo-tabs';

export default function Dashboard() {
  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Todo List */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" aria-hidden="true" />할 일 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TodoTabs />
        </CardContent>
      </Card>
    </div>
  );
}
