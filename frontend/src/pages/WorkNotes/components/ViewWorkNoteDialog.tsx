import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { API } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { WorkNote, CreateTodoRequest, TodoStatus } from '@/types/api';

interface ViewWorkNoteDialogProps {
  workNote: WorkNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewWorkNoteDialog({
  workNote,
  open,
  onOpenChange,
}: ViewWorkNoteDialogProps) {
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDescription, setTodoDescription] = useState('');
  // Set default due date to today in YYYY-MM-DD format
  const [todoDueDate, setTodoDueDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch todos for this work note
  const { data: todos = [], isLoading: todosLoading } = useQuery({
    queryKey: ['work-note-todos', workNote?.id],
    queryFn: () => (workNote ? API.getWorkNoteTodos(workNote.id) : Promise.resolve([])),
    enabled: !!workNote && open,
  });

  // Create todo mutation
  const createTodoMutation = useMutation({
    mutationFn: (data: CreateTodoRequest) =>
      workNote ? API.createWorkNoteTodo(workNote.id, data) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-note-todos', workNote?.id] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setTodoTitle('');
      setTodoDescription('');
      // Reset due date to today
      setTodoDueDate(new Date().toISOString().split('T')[0]);
      setShowAddTodo(false);
      toast({
        title: '성공',
        description: '할일이 추가되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할일을 추가할 수 없습니다.',
      });
    },
  });

  // Update todo status mutation
  const updateTodoMutation = useMutation({
    mutationFn: ({ todoId, status }: { todoId: string; status: TodoStatus }) =>
      API.updateTodo(todoId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-note-todos', workNote?.id] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      toast({
        title: '성공',
        description: '할일 상태가 변경되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할일 상태를 변경할 수 없습니다.',
      });
    },
  });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;

    const todoData: CreateTodoRequest = {
      title: todoTitle.trim(),
      description: todoDescription.trim() || undefined,
      dueDate: todoDueDate ? new Date(todoDueDate).toISOString() : undefined,
      repeatRule: 'NONE',
    };

    createTodoMutation.mutate(todoData);
  };

  const handleToggleTodoStatus = (todoId: string, currentStatus: TodoStatus) => {
    const newStatus: TodoStatus = currentStatus === '완료' ? '진행중' : '완료';
    updateTodoMutation.mutate({ todoId, status: newStatus });
  };

  if (!workNote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{workNote.title}</DialogTitle>
            <Badge variant="secondary">{workNote.category}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              생성일:{' '}
              {format(parseISO(workNote.createdAt), 'yyyy년 M월 d일 HH:mm', {
                locale: ko,
              })}
            </p>
            <p>
              수정일:{' '}
              {format(parseISO(workNote.updatedAt), 'yyyy년 M월 d일 HH:mm', {
                locale: ko,
              })}
            </p>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">내용</h3>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">{workNote.content}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">할일 목록</h3>
              <Button
                size="sm"
                onClick={() => setShowAddTodo(!showAddTodo)}
                variant={showAddTodo ? 'outline' : 'default'}
              >
                {showAddTodo ? '취소' : '할일 추가'}
              </Button>
            </div>

            {showAddTodo && (
              <form onSubmit={handleAddTodo} className="mb-4 p-3 border rounded-md space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="todo-title">할일 제목</Label>
                  <Input
                    id="todo-title"
                    value={todoTitle}
                    onChange={(e) => setTodoTitle(e.target.value)}
                    placeholder="할일을 입력하세요"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="todo-description">설명 (선택사항)</Label>
                  <Textarea
                    id="todo-description"
                    value={todoDescription}
                    onChange={(e) => setTodoDescription(e.target.value)}
                    placeholder="상세 설명"
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="todo-due-date">마감일 (선택사항)</Label>
                  <Input
                    id="todo-due-date"
                    type="date"
                    value={todoDueDate}
                    onChange={(e) => setTodoDueDate(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={createTodoMutation.isPending} className="w-full">
                  {createTodoMutation.isPending ? '추가 중...' : '추가'}
                </Button>
              </form>
            )}

            {todosLoading ? (
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            ) : todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 할일이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={todo.status === '완료'}
                      onCheckedChange={() => handleToggleTodoStatus(todo.id, todo.status)}
                      disabled={updateTodoMutation.isPending}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${todo.status === '완료' ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.title}
                      </p>
                      {todo.description && (
                        <p className="text-xs text-muted-foreground mt-1">{todo.description}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Badge variant={todo.status === '완료' ? 'secondary' : 'default'} className="text-xs">
                          {todo.status}
                        </Badge>
                        {todo.dueDate && (
                          <Badge variant="outline" className="text-xs">
                            마감: {format(parseISO(todo.dueDate), 'M/d', { locale: ko })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
