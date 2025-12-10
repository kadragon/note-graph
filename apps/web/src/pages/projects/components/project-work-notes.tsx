// Trace: SPEC-project-1, TASK-043

import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import {
  useAssignWorkNoteToProject,
  useProject,
  useRemoveWorkNoteFromProject,
} from '@web/hooks/use-projects';
import { useWorkNotes } from '@web/hooks/use-work-notes';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ProjectWorkNotesProps {
  projectId: string;
}

export function ProjectWorkNotes({ projectId }: ProjectWorkNotesProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedWorkNoteId, setSelectedWorkNoteId] = useState('');

  const { data: project } = useProject(projectId);
  const { data: allWorkNotes = [] } = useWorkNotes();
  const assignMutation = useAssignWorkNoteToProject();
  const removeMutation = useRemoveWorkNoteFromProject();

  const projectWorkNotes = project?.workNotes || [];
  const assignedWorkNoteIds = new Set(projectWorkNotes.map((wn) => wn.workId));
  const availableWorkNotes = allWorkNotes.filter((wn) => !assignedWorkNoteIds.has(wn.id));

  const handleAssign = async () => {
    if (!selectedWorkNoteId) return;

    try {
      await assignMutation.mutateAsync({
        projectId,
        data: { workId: selectedWorkNoteId },
      });
      setAssignDialogOpen(false);
      setSelectedWorkNoteId('');
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const handleRemove = async (workId: string) => {
    try {
      await removeMutation.mutateAsync({ projectId, workId });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>연결된 업무노트</CardTitle>
        <Button onClick={() => setAssignDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          업무노트 연결
        </Button>
      </CardHeader>
      <CardContent>
        {projectWorkNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">연결된 업무노트가 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>연결일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectWorkNotes.map((workNote) => (
                <TableRow key={workNote.id}>
                  <TableCell className="font-medium">{workNote.workTitle}</TableCell>
                  <TableCell>{workNote.workCategory || '-'}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {workNote.assignedAt
                        ? formatDistanceToNow(new Date(workNote.assignedAt), {
                            addSuffix: true,
                            locale: ko,
                          })
                        : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemove(workNote.workId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업무노트 연결</DialogTitle>
            <DialogDescription>프로젝트에 연결할 업무노트를 선택하세요.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedWorkNoteId} onValueChange={setSelectedWorkNoteId}>
              <SelectTrigger>
                <SelectValue placeholder="업무노트를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {availableWorkNotes.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    연결 가능한 업무노트가 없습니다.
                  </div>
                ) : (
                  availableWorkNotes.map((workNote) => (
                    <SelectItem key={workNote.id} value={workNote.id}>
                      {workNote.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => void handleAssign()}
              disabled={!selectedWorkNoteId || assignMutation.isPending}
            >
              {assignMutation.isPending ? '연결 중...' : '연결'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
