import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TodoTabs } from './components/TodoTabs';

export default function Dashboard() {
  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Todo List */}
      <Card>
        <CardHeader>
          <CardTitle>할 일 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <TodoTabs />
        </CardContent>
      </Card>
    </div>
  );
}
