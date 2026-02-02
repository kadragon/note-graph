import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TODO_STATUS } from '@web/constants/todo-status';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type {
  CreateWorkNoteRequest,
  DriveFileListItem,
  UpdateWorkNoteRequest,
  WorkNoteFileMigrationResult,
  WorkNoteFilesListResponse,
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
      if (workNotes.length === 0) {
        return [] as WorkNoteWithStats[];
      }

      const workIds = workNotes.map((workNote) => workNote.id);
      try {
        const todos = await API.getTodos('all', undefined, workIds);
        const todosByWorkId = new Map<string, typeof todos>();
        for (const todo of todos) {
          const workId = todo.workNoteId;
          if (!workId) {
            continue;
          }
          if (!todosByWorkId.has(workId)) {
            todosByWorkId.set(workId, []);
          }
          todosByWorkId.get(workId)?.push(todo);
        }

        const now = new Date();
        return workNotes.map((workNote) => {
          const workNoteTodos = todosByWorkId.get(workNote.id) ?? [];
          const total = workNoteTodos.length;
          // 한 번의 순회로 모든 통계 계산
          // Calculate tomorrow midnight for consistent wait_until comparison
          const tomorrowMidnight = new Date(now);
          tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
          tomorrowMidnight.setHours(0, 0, 0, 0);

          const { completed, pending, remaining } = workNoteTodos.reduce(
            (acc, todo) => {
              // Inactive statuses (완료, 보류, 중단) are excluded from remaining/pending counts
              if (todo.status === TODO_STATUS.COMPLETED) {
                acc.completed++;
              } else if (
                todo.status === TODO_STATUS.ON_HOLD ||
                todo.status === TODO_STATUS.STOPPED
              ) {
                // 보류/중단 are inactive - not counted in remaining or pending
                // (they are included in total only)
              } else {
                // 진행중 상태: waitUntil이 내일 이후면 pending, 아니면 remaining
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

          const latestTodoDate = getLatestTodoDate(workNoteTodos);
          // Find the most recent completion timestamp from completed todos.
          // If all completed todos lack updatedAt, this returns null and the work note
          // will only appear in the "All" completed tab, not time-filtered tabs.
          const latestCompletedAt = workNoteTodos.reduce<string | null>((latest, todo) => {
            if (todo.status !== TODO_STATUS.COMPLETED) {
              return latest;
            }
            const candidate = todo.updatedAt;
            if (!candidate) {
              return latest;
            }
            return !latest || candidate > latest ? candidate : latest;
          }, null);

          return {
            ...workNote,
            todoStats: { total, completed, remaining, pending },
            latestTodoDate,
            latestCompletedAt,
          } as WorkNoteWithStats;
        });
      } catch (error) {
        // Log error for debugging
        console.error('Failed to fetch todos for work notes:', error);

        return workNotes.map((workNote) => ({
          ...workNote,
          todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
          latestTodoDate: null,
          latestCompletedAt: null,
        })) as WorkNoteWithStats[];
      }
    },
  });
}

export const useCreateWorkNote = createStandardMutation({
  mutationFn: (data: CreateWorkNoteRequest) => API.createWorkNote(data),
  invalidateKeys: [['work-notes'], ['work-notes-with-stats']],
  messages: {
    success: '업무노트가 생성되었습니다.',
    error: '업무노트를 생성할 수 없습니다.',
  },
});

export const useUpdateWorkNote = createStandardMutation({
  mutationFn: ({ workId, data }: { workId: string; data: UpdateWorkNoteRequest }) =>
    API.updateWorkNote(workId, data),
  invalidateKeys: (_data, variables) => [
    ['work-notes'],
    ['work-notes-with-stats'],
    ['work-note-detail', variables.workId],
  ],
  messages: {
    success: '업무노트가 수정되었습니다.',
    error: '업무노트를 수정할 수 없습니다.',
  },
});

export const useDeleteWorkNote = createStandardMutation({
  mutationFn: (workId: string) => API.deleteWorkNote(workId),
  invalidateKeys: [['work-notes'], ['work-notes-with-stats']],
  messages: {
    success: '업무노트가 삭제되었습니다.',
    error: '업무노트를 삭제할 수 없습니다.',
  },
});

// Work note file hooks
export function useWorkNoteFiles(workId: string | null) {
  return useQuery({
    queryKey: ['work-note-files', workId],
    queryFn: () =>
      workId
        ? API.getWorkNoteFiles(workId)
        : Promise.resolve({
            files: [],
            driveFolderId: null,
            driveFolderLink: null,
            googleDriveConfigured: true,
            hasLegacyFiles: false,
          } as WorkNoteFilesListResponse),
    enabled: !!workId,
  });
}

export function useGoogleDriveStatus() {
  return useQuery({
    queryKey: ['google-drive-status'],
    queryFn: () => API.getGoogleDriveStatus(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - status rarely changes
  });
}

export function useGoogleDriveConfigStatus() {
  const { data, ...rest } = useGoogleDriveStatus();
  return {
    configured: data?.configured ?? false,
    data,
    ...rest,
  };
}

export const useUploadWorkNoteFile = createStandardMutation({
  mutationFn: ({ workId, file }: { workId: string; file: File }) =>
    API.uploadWorkNoteFile(workId, file),
  invalidateKeys: (_data, variables) => [
    ['work-note-files', variables.workId],
    ['work-note-detail', variables.workId],
  ],
  messages: {
    success: '파일이 업로드되었습니다.',
    error: '파일을 업로드할 수 없습니다.',
  },
});

export const useDeleteWorkNoteFile = createStandardMutation({
  mutationFn: ({ workId, fileId }: { workId: string; fileId: string }) =>
    API.deleteWorkNoteFile(workId, fileId),
  invalidateKeys: (_data, variables) => [
    ['work-note-files', variables.workId],
    ['work-note-detail', variables.workId],
  ],
  messages: {
    success: '파일이 삭제되었습니다.',
    error: '파일을 삭제할 수 없습니다.',
  },
});

// Keep manual - complex success message based on migration result
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

/**
 * Get download link for a work note file
 * For Drive files, returns the webViewLink directly
 */
export function downloadWorkNoteFile(file: DriveFileListItem): string {
  return file.webViewLink;
}
