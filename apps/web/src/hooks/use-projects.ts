// Trace: SPEC-project-1, TASK-043
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type {
  AssignWorkNoteRequest,
  CreateProjectRequest,
  ProjectFilters,
  UpdateProjectRequest,
  WorkNoteFileMigrationResult,
} from '@web/types/api';

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => API.getProjects(filters),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => API.getProject(projectId),
    enabled: !!projectId,
  });
}

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => API.getProjectStats(projectId),
    enabled: !!projectId,
  });
}

export function useProjectTodos(projectId: string) {
  return useQuery({
    queryKey: ['project-todos', projectId],
    queryFn: () => API.getProjectTodos(projectId),
    enabled: !!projectId,
  });
}

export const useCreateProject = createStandardMutation({
  mutationFn: (data: CreateProjectRequest) => API.createProject(data),
  invalidateKeys: [['projects']],
  messages: {
    success: '프로젝트가 생성되었습니다.',
    error: '프로젝트를 생성할 수 없습니다.',
  },
});

export const useUpdateProject = createStandardMutation({
  mutationFn: ({ projectId, data }: { projectId: string; data: UpdateProjectRequest }) =>
    API.updateProject(projectId, data),
  invalidateKeys: (_data, variables) => [['projects'], ['project', variables.projectId]],
  messages: {
    success: '프로젝트가 수정되었습니다.',
    error: '프로젝트를 수정할 수 없습니다.',
  },
});

export const useDeleteProject = createStandardMutation({
  mutationFn: (projectId: string) => API.deleteProject(projectId),
  invalidateKeys: [['projects']],
  messages: {
    success: '프로젝트가 삭제되었습니다.',
    error: '프로젝트를 삭제할 수 없습니다.',
  },
});

// Project Work Notes
export function useProjectWorkNotes(projectId: string) {
  return useQuery({
    queryKey: ['project-work-notes', projectId],
    queryFn: () => API.getProjectWorkNotes(projectId),
    enabled: !!projectId,
  });
}

export const useAssignWorkNoteToProject = createStandardMutation({
  mutationFn: ({ projectId, data }: { projectId: string; data: AssignWorkNoteRequest }) =>
    API.assignWorkNoteToProject(projectId, data),
  invalidateKeys: (_data, variables) => [
    ['project', variables.projectId],
    ['project-work-notes', variables.projectId],
  ],
  messages: {
    success: '업무노트가 프로젝트에 연결되었습니다.',
    error: '업무노트를 연결할 수 없습니다.',
  },
});

export const useRemoveWorkNoteFromProject = createStandardMutation({
  mutationFn: ({ projectId, workId }: { projectId: string; workId: string }) =>
    API.removeWorkNoteFromProject(projectId, workId),
  invalidateKeys: (_data, variables) => [
    ['project', variables.projectId],
    ['project-work-notes', variables.projectId],
  ],
  messages: {
    success: '업무노트 연결이 해제되었습니다.',
    error: '업무노트 연결을 해제할 수 없습니다.',
  },
});

// Project Files
export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => API.getProjectFiles(projectId),
    enabled: !!projectId,
  });
}

export const useUploadProjectFile = createStandardMutation({
  mutationFn: ({ projectId, file }: { projectId: string; file: File }) =>
    API.uploadProjectFile(projectId, file),
  invalidateKeys: (_data, variables) => [
    ['project-files', variables.projectId],
    ['project', variables.projectId],
  ],
  messages: {
    success: '파일이 업로드되었습니다.',
    error: '파일을 업로드할 수 없습니다.',
  },
});

export const useDeleteProjectFile = createStandardMutation({
  mutationFn: ({ projectId, fileId }: { projectId: string; fileId: string }) =>
    API.deleteProjectFile(projectId, fileId),
  invalidateKeys: (_data, variables) => [
    ['project-files', variables.projectId],
    ['project', variables.projectId],
  ],
  messages: {
    success: '파일이 삭제되었습니다.',
    error: '파일을 삭제할 수 없습니다.',
  },
});

// Keep manual - complex success message based on migration result
export function useMigrateProjectFiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => API.migrateProjectFiles(projectId),
    onSuccess: (result: WorkNoteFileMigrationResult, projectId: string) => {
      void queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });

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
