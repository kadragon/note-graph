import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import type { Todo, TodoStatus, TodoView, UpdateTodoRequest } from '@web/types/api';
import { useToast } from './use-toast';

export function useTodos(view: TodoView = 'today', year?: number) {
  return useQuery({
    queryKey: ['todos', view, year],
    queryFn: () => API.getTodos(view, year),
  });
}

export function useToggleTodo(workNoteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TodoStatus }) =>
      API.updateTodo(id, { status }),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches for all related queries
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      if (workNoteId) {
        await queryClient.cancelQueries({ queryKey: ['work-note-todos', workNoteId] });
      }

      // Snapshot the previous values
      const previousTodos = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
        }));

      const previousWorkNoteTodos = workNoteId
        ? queryClient.getQueryData<Todo[]>(['work-note-todos', workNoteId])
        : undefined;

      // Optimistically update all todo queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .forEach((query) => {
          queryClient.setQueryData<Todo[]>(query.queryKey, (old) => {
            if (!old) return old;
            return old.map((todo) => (todo.id === id ? { ...todo, status } : todo));
          });
        });

      // Optimistically update work-note-todos query if workNoteId is provided
      if (workNoteId) {
        queryClient.setQueryData<Todo[]>(
          ['work-note-todos', workNoteId],
          (old) => old?.map((todo) => (todo.id === id ? { ...todo, status } : todo)) ?? []
        );
      }

      // Return context with the previous values
      return { previousTodos, previousWorkNoteTodos, workNoteId };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousTodos) {
        context.previousTodos.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      if (context?.workNoteId && context?.previousWorkNoteTodos) {
        queryClient.setQueryData(
          ['work-note-todos', context.workNoteId],
          context.previousWorkNoteTodos
        );
      }

      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할 일 상태를 변경할 수 없습니다.',
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      // Invalidate to ensure we have the latest data
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      if (context?.workNoteId) {
        void queryClient.invalidateQueries({ queryKey: ['work-note-todos', context.workNoteId] });
      }
    },
    onSuccess: () => {
      toast({
        title: '성공',
        description: '할일 상태가 변경되었습니다.',
      });
    },
  });
}

export function useUpdateTodo(workNoteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTodoRequest }) => API.updateTodo(id, data),
    onSuccess: () => {
      // Invalidate to ensure we have the latest data
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      if (workNoteId) {
        void queryClient.invalidateQueries({ queryKey: ['work-note-todos', workNoteId] });
      }
      toast({
        title: '성공',
        description: '할일이 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할일을 수정할 수 없습니다.',
      });
    },
  });
}

export function useDeleteTodo(workNoteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (todoId: string) => API.deleteTodo(todoId),
    onMutate: async (todoId) => {
      // Cancel outgoing refetches for all related queries
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      if (workNoteId) {
        await queryClient.cancelQueries({ queryKey: ['work-note-todos', workNoteId] });
      }

      // Snapshot the previous values
      const previousTodos = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
        }));

      const previousWorkNoteTodos = workNoteId
        ? queryClient.getQueryData<Todo[]>(['work-note-todos', workNoteId])
        : undefined;

      // Optimistically remove todo from all todo queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ['todos'] })
        .forEach((query) => {
          queryClient.setQueryData<Todo[]>(query.queryKey, (old) => {
            if (!old) return old;
            return old.filter((todo) => todo.id !== todoId);
          });
        });

      // Optimistically remove todo from work-note-todos query if workNoteId is provided
      if (workNoteId) {
        queryClient.setQueryData<Todo[]>(
          ['work-note-todos', workNoteId],
          (old) => old?.filter((todo) => todo.id !== todoId) ?? []
        );
      }

      // Return context with the previous values
      return { previousTodos, previousWorkNoteTodos, workNoteId };
    },
    onError: (error, _todoId, context) => {
      // Rollback to previous value on error
      if (context?.previousTodos) {
        context.previousTodos.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      if (context?.workNoteId && context?.previousWorkNoteTodos) {
        queryClient.setQueryData(
          ['work-note-todos', context.workNoteId],
          context.previousWorkNoteTodos
        );
      }

      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할일을 삭제할 수 없습니다.',
      });
    },
    onSettled: (_data, _error, _todoId, context) => {
      // Invalidate to ensure we have the latest data
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      if (context?.workNoteId) {
        void queryClient.invalidateQueries({ queryKey: ['work-note-todos', context.workNoteId] });
      }
    },
    onSuccess: () => {
      toast({
        title: '성공',
        description: '할일이 삭제되었습니다.',
      });
    },
  });
}
