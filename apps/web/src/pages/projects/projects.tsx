// Trace: SPEC-project-1, TASK-043

import { StateRenderer } from '@web/components/state-renderer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@web/components/ui/alert-dialog';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import { useDialogState } from '@web/hooks/use-dialog-state';
import { usePersons } from '@web/hooks/use-persons';
import { useDeleteProject, useProjects } from '@web/hooks/use-projects';
import type { Project, ProjectStatus } from '@web/types/api';
import { Filter, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectDialog } from './components/create-project-dialog';
import { ProjectDetailDialog } from './components/project-detail-dialog';
import { ProjectsTable } from './components/projects-table';

export default function Projects() {
  const createDialog = useDialogState();
  const detailDialog = useDialogState<string>();
  const deleteDialog = useDialogState<string>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [leaderFilter, setLeaderFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const { data: persons = [] } = usePersons();
  const { data: projects = [], isLoading } = useProjects({
    status: statusFilter === 'all' ? undefined : statusFilter,
    leaderPersonId: leaderFilter === 'all' ? undefined : leaderFilter,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
  });
  const deleteMutation = useDeleteProject();

  const handleView = (project: Project) => {
    detailDialog.open(project.projectId);
  };

  const handleDeleteClick = (projectId: string) => {
    deleteDialog.open(projectId);
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.id) {
      await deleteMutation.mutateAsync(deleteDialog.id);
      deleteDialog.close();
    }
  };

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
        <Button onClick={createDialog.open}>
          <Plus className="h-4 w-4 mr-2" />새 프로젝트
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as ProjectStatus | 'all')}
              >
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
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">시작일 이전</p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                />
                <Button type="button" variant="ghost" size="icon" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StateRenderer
            isLoading={isLoading}
            isEmpty={projects.length === 0}
            emptyMessage="프로젝트가 없습니다. 새 프로젝트를 만들어보세요."
          >
            <ProjectsTable projects={projects} onView={handleView} onDelete={handleDeleteClick} />
          </StateRenderer>
        </CardContent>
      </Card>

      <CreateProjectDialog open={createDialog.isOpen} onOpenChange={createDialog.onOpenChange} />

      {detailDialog.id && (
        <ProjectDetailDialog
          open={detailDialog.isOpen}
          onOpenChange={detailDialog.onOpenChange}
          projectId={detailDialog.id}
        />
      )}

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
