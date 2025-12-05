// Trace: SPEC-project-1, TASK-043

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectTodos } from '@/hooks/useProjects';
import type { ProjectStats, TodoStatus } from '@/types/api';

interface ProjectTodosProps {
  projectId: string;
  stats?: ProjectStats;
}

const STATUS_COLOR: Record<TodoStatus, string> = {
  진행중: 'bg-blue-500',
  완료: 'bg-green-500',
  보류: 'bg-amber-500',
  중단: 'bg-red-500',
};

export function ProjectTodos({ projectId, stats }: ProjectTodosProps) {
  const { data: todos = [], isLoading, error } = useProjectTodos(projectId);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">전체 할일</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalTodos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">완료</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.completedTodos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">대기/진행</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.pendingTodos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">보류</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{stats.onHoldTodos}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>프로젝트 할일</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">로딩 중...</p>
          ) : error ? (
            <p className="text-destructive text-sm">할일 목록을 불러올 수 없습니다.</p>
          ) : todos.length === 0 ? (
            <p className="text-muted-foreground text-sm">등록된 할일이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>마감</TableHead>
                  <TableHead>작성</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((todo) => (
                  <TableRow key={todo.id}>
                    <TableCell className="font-medium">{todo.title}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[todo.status]}>{todo.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ko-KR') : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(todo.createdAt), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
