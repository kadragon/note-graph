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
import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import { useDialogState } from '@web/hooks/use-dialog-state';
import {
  useDeleteWorkNoteGroup,
  useToggleWorkNoteGroupActive,
  useWorkNoteGroups,
} from '@web/hooks/use-work-note-groups';
import type { WorkNoteGroup } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CreateWorkNoteGroupDialog } from './components/create-work-note-group-dialog';
import { EditWorkNoteGroupDialog } from './components/edit-work-note-group-dialog';

export default function WorkNoteGroups() {
  const createDialog = useDialogState();
  const editDialog = useDialogState<WorkNoteGroup>();
  const deleteDialog = useDialogState<WorkNoteGroup>();

  const { data: groups = [], isLoading } = useWorkNoteGroups();
  const deleteMutation = useDeleteWorkNoteGroup();
  const toggleActiveMutation = useToggleWorkNoteGroupActive();

  const handleToggleActive = (group: WorkNoteGroup) => {
    toggleActiveMutation.mutate({
      groupId: group.groupId,
      isActive: !group.isActive,
    });
  };

  const handleEdit = (group: WorkNoteGroup) => {
    editDialog.open(group);
  };

  const handleDelete = (group: WorkNoteGroup) => {
    deleteDialog.open(group);
  };

  const handleDeleteConfirm = () => {
    if (!deleteDialog.id) return;

    deleteMutation.mutate(deleteDialog.id.groupId, {
      onSuccess: () => {
        deleteDialog.close();
      },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">업무 그룹 관리</h1>
          <p className="page-description">업무 그룹을 관리하세요</p>
        </div>
        <Button onClick={createDialog.open}>
          <Plus className="h-4 w-4 mr-2" />새 업무 그룹
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무 그룹 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <StateRenderer
            isLoading={isLoading}
            isEmpty={groups.length === 0}
            emptyMessage="등록된 업무 그룹이 없습니다."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업무 그룹</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.groupId} className={!group.isActive ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={group.isActive ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(group)}
                      >
                        {group.isActive ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(parseISO(group.createdAt), 'yyyy-MM-dd HH:mm', {
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(group)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(group)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StateRenderer>
        </CardContent>
      </Card>

      <CreateWorkNoteGroupDialog
        open={createDialog.isOpen}
        onOpenChange={createDialog.onOpenChange}
      />

      <EditWorkNoteGroupDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        group={editDialog.id}
      />

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무 그룹 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteDialog.id?.name}&quot; 업무 그룹을 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
