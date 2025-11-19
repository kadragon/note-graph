import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { Todo, TodoView, TodoStatus } from '@/types/api';

export function useTodos(view: TodoView = 'all') {
  return useQuery({
    queryKey: ['todos', view],
    queryFn: () => API.getTodos(view),
  });
}

export function useToggleTodo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TodoStatus }) =>
      API.updateTodo(id, { status }),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot the previous value
      const previousTodos = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
        }));

      // Optimistically update all todo queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .forEach((query) => {
          queryClient.setQueryData<Todo[]>(query.queryKey, (old) => {
            if (!old) return old;
            return old.map((todo) =>
              todo.id === id ? { ...todo, status } : todo
            );
          });
        });

      // Return context with the previous value
      return { previousTodos };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousTodos) {
        context.previousTodos.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할 일 상태를 변경할 수 없습니다.',
      });
    },
    onSuccess: () => {
      // Invalidate to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
    },
  });
}
