import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TODO_STATUS } from '@web/constants/todo-status';
import { API } from '@web/lib/api';
import type {
  CreateWorkNoteRequest,
  UpdateWorkNoteRequest,
  WorkNoteFile,
  WorkNoteFileMigrationResult,
  WorkNoteWithStats,
} from '@web/types/api';
import { getLatestTodoDate } from './get-latest-todo-date';
import { useToast } from './use-toast';

export function useWorkNotes() {
  return useQuery({
    queryKey: ['work-notes'],
    queryFn: () => API.getWorkNotes(),
  });
}

export function useWorkNotesWithStats() {
  return useQuery({
    queryKey: ['work-notes-with-stats'],
    queryFn: async () => {
      const workNotes = await API.getWorkNotes();

      // Fetch todos for all work notes in parallel
      const now = new Date();
      const workNotesWithStats = await Promise.all(
        workNotes.map(async (workNote) => {
          try {
            const todos = await API.getWorkNoteTodos(workNote.id);
            const total = todos.length;
            // 한 번의 순회로 모든 통계 계산
            // Calculate tomorrow midnight for consistent wait_until comparison
            const tomorrowMidnight = new Date(now);
            tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
            tomorrowMidnight.setHours(0, 0, 0, 0);

            const { completed, pending, remaining } = todos.reduce(
              (acc, todo) => {
                if (todo.status === TODO_STATUS.COMPLETED) {
                  acc.completed++;
                } else {
                  // 미완료 상태: waitUntil이 내일 이후면 pending, 아니면 remaining
                  // 백엔드와 동일한 로직: waitUntil < tomorrowMidnight이면 remaining
                  const hasFutureWaitUntil =
                    todo.waitUntil && new Date(todo.waitUntil) >= tomorrowMidnight;
                  if (hasFutureWaitUntil) {
                    acc.pending++;
                  } else {
                    acc.remaining++;
                  }
                }
                return acc;
              },
              { completed: 0, pending: 0, remaining: 0 }
            );

            const latestTodoDate = getLatestTodoDate(todos);

            return {
              ...workNote,
              todoStats: { total, completed, remaining, pending },
              latestTodoDate,
            } as WorkNoteWithStats;
          } catch (error) {
            // Log error for debugging
            console.error(`Failed to fetch todos for work note ${workNote.id}:`, error);

            // If there's an error fetching todos, return with zero stats
            return {
              ...workNote,
              todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
              latestTodoDate: null,
            } as WorkNoteWithStats;
          }
        })
      );

      return workNotesWithStats;
    },
  });
}

export function useCreateWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateWorkNoteRequest) => API.createWorkNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      toast({
        title: '성공',
        description: '업무노트가 생성되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 생성할 수 없습니다.',
      });
    },
  });
}

export function useUpdateWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workId, data }: { workId: string; data: UpdateWorkNoteRequest }) =>
      API.updateWorkNote(workId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['work-note-detail', variables.workId] });
      toast({
        title: '성공',
        description: '업무노트가 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 수정할 수 없습니다.',
      });
    },
  });
}

export function useDeleteWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (workId: string) => API.deleteWorkNote(workId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      toast({
        title: '성공',
        description: '업무노트가 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 삭제할 수 없습니다.',
      });
    },
  });
}

// Work note file hooks
export function useWorkNoteFiles(workId: string | null) {
  return useQuery({
    queryKey: ['work-note-files', workId],
    queryFn: () => (workId ? API.getWorkNoteFiles(workId) : Promise.resolve([])),
    enabled: !!workId,
  });
}

export function useUploadWorkNoteFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workId, file }: { workId: string; file: File }) =>
      API.uploadWorkNoteFile(workId, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['work-note-files', variables.workId] });
      void queryClient.invalidateQueries({ queryKey: ['work-note-detail', variables.workId] });
      toast({
        title: '성공',
        description: '파일이 업로드되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '파일을 업로드할 수 없습니다.',
      });
    },
  });
}

export function useDeleteWorkNoteFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workId, fileId }: { workId: string; fileId: string }) =>
      API.deleteWorkNoteFile(workId, fileId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['work-note-files', variables.workId] });
      void queryClient.invalidateQueries({ queryKey: ['work-note-detail', variables.workId] });
      toast({
        title: '성공',
        description: '파일이 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '파일을 삭제할 수 없습니다.',
      });
    },
  });
}

export function useMigrateWorkNoteFiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (workId: string) => API.migrateWorkNoteFiles(workId),
    onSuccess: (result: WorkNoteFileMigrationResult, workId: string) => {
      void queryClient.invalidateQueries({ queryKey: ['work-note-files', workId] });
      void queryClient.invalidateQueries({ queryKey: ['work-note-detail', workId] });
      const summary = `이동 ${result.migrated}개 · 건너뜀 ${result.skipped}개 · 실패 ${result.failed}개`;
      const description =
        result.migrated === 0 && result.skipped === 0 && result.failed === 0
          ? '옮길 R2 파일이 없습니다.'
          : `마이그레이션 완료: ${summary}`;
      toast({
        title: '성공',
        description,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '파일을 옮길 수 없습니다.',
      });
    },
  });
}

export async function downloadWorkNoteFile(workId: string, file: WorkNoteFile) {
  if (file.storageType === 'GDRIVE' && file.gdriveWebViewLink) {
    return file.gdriveWebViewLink;
  }

  const blob = await API.downloadWorkNoteFile(workId, file.fileId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}
