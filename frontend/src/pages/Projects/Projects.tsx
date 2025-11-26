// Trace: SPEC-project-1, TASK-043
import { useMemo, useState } from 'react';
import { Filter, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjects, useDeleteProject } from '@/hooks/useProjects';
import { ProjectsTable } from './components/ProjectsTable';
import { CreateProjectDialog } from './components/CreateProjectDialog';
import { ProjectDetailDialog } from './components/ProjectDetailDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Project, ProjectStatus } from '@/types/api';
import { usePersons } from '@/hooks/usePersons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [leaderFilter, setLeaderFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const { data: persons = [] } = usePersons();
  const { data: projects = [], isLoading } = useProjects();
  const deleteMutation = useDeleteProject();

  const handleView = (project: Project) => {
    setSelectedProject(project);
    setDetailDialogOpen(true);
  };

  const handleDeleteClick = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (projectToDelete) {
      await deleteMutation.mutateAsync(projectToDelete);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (leaderFilter !== 'all' && project.leaderPersonId !== leaderFilter) return false;

      if (startDateFilter) {
        const start = new Date(startDateFilter).getTime();
        const created = new Date(project.createdAt).getTime();
        if (created < start) return false;
      }

      if (endDateFilter) {
        const end = new Date(endDateFilter).getTime();
        const created = new Date(project.createdAt).getTime();
        if (created > end) return false;
      }

      return true;
    });
  }, [projects, statusFilter, leaderFilter, startDateFilter, endDateFilter]);

  const resetFilters = () => {
    setStatusFilter('all');
    setLeaderFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">프로젝트</h1>
          <p className="page-description">프로젝트를 관리하세요</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 프로젝트
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>프로젝트 목록</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              필터
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">상태</p>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="진행중">진행중</SelectItem>
                  <SelectItem value="완료">완료</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                  <SelectItem value="중단">중단</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">리더</p>
              <Select value={leaderFilter} onValueChange={setLeaderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {persons.map((person) => (
                    <SelectItem key={person.personId} value={person.personId}>
                      {person.name} ({person.personId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">시작일 이후</p>
              <Input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">시작일 이전</p>
              <div className="flex gap-2">
                <Input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              로딩 중...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              프로젝트가 없습니다. 새 프로젝트를 만들어보세요.
            </div>
          ) : (
            <ProjectsTable
              projects={filteredProjects}
              onView={handleView}
              onDelete={handleDeleteClick}
            />
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedProject && (
        <ProjectDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          projectId={selectedProject.projectId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
