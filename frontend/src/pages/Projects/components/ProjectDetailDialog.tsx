// Trace: SPEC-project-1, TASK-043

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject, useProjectStats } from '@/hooks/useProjects';
import type { ProjectStatus } from '@/types/api';
import { ProjectFiles } from './ProjectFiles';
import { ProjectTodos } from './ProjectTodos';
import { ProjectWorkNotes } from './ProjectWorkNotes';

interface ProjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  진행중: 'bg-blue-500',
  완료: 'bg-green-500',
  보류: 'bg-yellow-500',
  중단: 'bg-red-500',
};

export function ProjectDetailDialog({ open, onOpenChange, projectId }: ProjectDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('info');
  const { data: project, isLoading } = useProject(projectId);
  const { data: stats } = useProjectStats(projectId);

  if (isLoading || !project) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {project.name}
            <Badge className={STATUS_COLORS[project.status]}>{project.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">프로젝트 정보</TabsTrigger>
            <TabsTrigger value="worknotes">업무노트</TabsTrigger>
            <TabsTrigger value="todos">할일</TabsTrigger>
            <TabsTrigger value="files">파일</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">프로젝트 ID</p>
                    <p className="text-sm">{project.projectId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">상태</p>
                    <Badge className={STATUS_COLORS[project.status]}>{project.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">우선순위</p>
                    <p className="text-sm">{project.priority || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">리더</p>
                    <p className="text-sm">{project.leaderPersonId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">담당 부서</p>
                    <p className="text-sm">{project.deptName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">생성일</p>
                    <p className="text-sm">
                      {formatDistanceToNow(new Date(project.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </p>
                  </div>
                  {project.startDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">시작일</p>
                      <p className="text-sm">
                        {new Date(project.startDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  )}
                  {project.targetEndDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">목표 종료일</p>
                      <p className="text-sm">
                        {new Date(project.targetEndDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  )}
                </div>

                {project.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">설명</p>
                    <p className="text-sm whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}

                {project.tags && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">태그</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.split(',').map((tag, _index) => (
                        <Badge key={tag.trim()} variant="outline">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {project.participants && project.participants.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">참여자</p>
                    <div className="flex flex-wrap gap-2">
                      {project.participants.map((participant) => (
                        <Badge key={participant.id} variant="secondary">
                          {participant.personName || participant.personId} ({participant.role})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">전체 할일</p>
                      <p className="text-2xl font-bold">{stats.totalTodos}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">완료된 할일</p>
                      <p className="text-2xl font-bold text-green-600">{stats.completedTodos}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">대기 중인 할일</p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.pendingTodos}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">보류된 할일</p>
                      <p className="text-2xl font-bold text-orange-600">{stats.onHoldTodos}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">파일 수</p>
                      <p className="text-2xl font-bold">{stats.fileCount}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">총 파일 크기</p>
                      <p className="text-2xl font-bold">
                        {(stats.totalFileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="worknotes">
            <ProjectWorkNotes projectId={projectId} />
          </TabsContent>

          <TabsContent value="todos">
            <ProjectTodos projectId={projectId} stats={stats} />
          </TabsContent>

          <TabsContent value="files">
            <ProjectFiles projectId={projectId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
