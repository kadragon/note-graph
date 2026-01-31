// Trace: SPEC-project-1, TASK-043

import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import type { Project, ProjectStatus } from '@web/types/api';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Eye, Trash2 } from 'lucide-react';

interface ProjectsTableProps {
  projects: Project[];
  onView: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  진행중: 'bg-blue-500',
  완료: 'bg-green-500',
  보류: 'bg-yellow-500',
  중단: 'bg-red-500',
};

export function ProjectsTable({ projects, onView, onDelete }: ProjectsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>프로젝트명</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>우선순위</TableHead>
          <TableHead>리더</TableHead>
          <TableHead>목표일</TableHead>
          <TableHead>생성일</TableHead>
          <TableHead className="text-right">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow
            key={project.projectId}
            className="cursor-pointer"
            onClick={() => onView(project)}
          >
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell>
              <Badge className={STATUS_COLORS[project.status]}>{project.status}</Badge>
            </TableCell>
            <TableCell>
              {project.priority ? (
                <Badge variant="outline">{project.priority}</Badge>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </TableCell>
            <TableCell>
              {project.leaderPersonId ? (
                <span className="text-sm">{project.leaderPersonId}</span>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </TableCell>
            <TableCell>
              {project.targetEndDate ? (
                <span className="text-sm">
                  {new Date(project.targetEndDate).toLocaleDateString('ko-KR')}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(project.createdAt), {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="보기"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(project);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.projectId);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
