import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TodoTabs } from './components/TodoTabs';
import { useTodos } from '@/hooks/useTodos';

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const { data: todayTodos = [] } = useTodos('today', currentYear);
  const { data: remainingTodos = [] } = useTodos('remaining', currentYear);
  const { data: completedTodos = [] } = useTodos('completed', currentYear);

  // Calculate statistics
  const todayCount = todayTodos.length;
  const completedTodayCount = todayTodos.filter(t => t.status === '완료').length;
  const remainingCount = remainingTodos.length;
  const totalCompletedCount = completedTodos.length;

  const stats = [
    {
      title: '오늘 할 일',
      value: todayCount,
      description: `${completedTodayCount}개 완료`,
      icon: Clock,
      className: 'text-blue-600 bg-blue-100',
    },
    {
      title: '남은 할 일',
      value: remainingCount,
      description: '미완료 항목',
      icon: AlertCircle,
      className: 'text-orange-600 bg-orange-100',
    },
    {
      title: '완료된 할 일',
      value: totalCompletedCount,
      description: '올해 완료',
      icon: CheckCircle2,
      className: 'text-green-600 bg-green-100',
    },
    {
      title: '전체 할 일',
      value: todayCount + remainingCount + totalCompletedCount,
      description: '총 항목 수',
      icon: ListTodo,
      className: 'text-purple-600 bg-purple-100',
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-md p-2 ${stat.className}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
