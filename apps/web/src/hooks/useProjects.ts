// Trace: SPEC-project-1, TASK-043
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import type {
  AssignWorkNoteRequest,
  CreateProjectRequest,
  ProjectFilters,
  UpdateProjectRequest,
} from '@/types/api';
import { useToast } from './use-toast';

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

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => API.createProject(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: '성공',
        description: '프로젝트가 생성되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '프로젝트를 생성할 수 없습니다.',
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: UpdateProjectRequest }) =>
      API.updateProject(projectId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      toast({
        title: '성공',
        description: '프로젝트가 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '프로젝트를 수정할 수 없습니다.',
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => API.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: '성공',
        description: '프로젝트가 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '프로젝트를 삭제할 수 없습니다.',
      });
    },
  });
}

// Project Work Notes
export function useProjectWorkNotes(projectId: string) {
  return useQuery({
    queryKey: ['project-work-notes', projectId],
    queryFn: () => API.getProjectWorkNotes(projectId),
    enabled: !!projectId,
  });
}

export function useAssignWorkNoteToProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: AssignWorkNoteRequest }) =>
      API.assignWorkNoteToProject(projectId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project-work-notes', variables.projectId] });
      toast({
        title: '성공',
        description: '업무노트가 프로젝트에 연결되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 연결할 수 없습니다.',
      });
    },
  });
}

export function useRemoveWorkNoteFromProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, workId }: { projectId: string; workId: string }) =>
      API.removeWorkNoteFromProject(projectId, workId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project-work-notes', variables.projectId] });
      toast({
        title: '성공',
        description: '업무노트 연결이 해제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트 연결을 해제할 수 없습니다.',
      });
    },
  });
}

// Project Files
export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => API.getProjectFiles(projectId),
    enabled: !!projectId,
  });
}

export function useUploadProjectFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, file }: { projectId: string; file: File }) =>
      API.uploadProjectFile(projectId, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['project-files', variables.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
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

export function useDeleteProjectFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, fileId }: { projectId: string; fileId: string }) =>
      API.deleteProjectFile(projectId, fileId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['project-files', variables.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
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
