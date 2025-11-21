import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TodoTabs } from './components/TodoTabs';
import { useTodos } from '@/hooks/useTodos';
import { TODO_STATUS } from '@/constants/todoStatus';

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const { data: todayTodos = [] } = useTodos('today', currentYear);
  const { data: remainingTodos = [] } = useTodos('remaining', currentYear);
  const { data: completedTodos = [] } = useTodos('completed', currentYear);

  // Calculate statistics
  const todayCount = todayTodos.length;
  const completedTodayCount = todayTodos.filter(t => t.status === TODO_STATUS.COMPLETED).length;
  const remainingCount = remainingTodos.length;
  const totalCompletedCount = completedTodos.length;

  const stats = [
    {
      title: '오늘 할 일',
      value: todayCount,
      description: `${completedTodayCount}개 완료`,
      icon: Clock,
      iconClassName: 'text-primary bg-primary/10',
    },
    {
      title: '남은 할 일',
      value: remainingCount,
      description: '미완료 항목',
      icon: AlertCircle,
      iconClassName: 'text-orange-500 bg-orange-500/10 dark:text-orange-400 dark:bg-orange-400/10',
    },
    {
      title: '완료된 할 일',
      value: totalCompletedCount,
      description: '올해 완료',
      icon: CheckCircle2,
      iconClassName: 'text-green-600 bg-green-600/10 dark:text-green-400 dark:bg-green-400/10',
    },
    {
      title: '전체 할 일',
      value: remainingCount + totalCompletedCount,
      description: '총 항목 수',
      icon: ListTodo,
      iconClassName: 'text-purple-600 bg-purple-600/10 dark:text-purple-400 dark:bg-purple-400/10',
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
                <div className={`rounded-md p-2 ${stat.iconClassName}`}>
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
