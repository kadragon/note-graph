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
  useDeleteTaskCategory,
  useTaskCategories,
  useToggleTaskCategoryActive,
} from '@web/hooks/use-task-categories';
import type { TaskCategory } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CreateTaskCategoryDialog } from './components/create-task-category-dialog';
import { EditTaskCategoryDialog } from './components/edit-task-category-dialog';

export default function TaskCategories() {
  const createDialog = useDialogState();
  const editDialog = useDialogState<TaskCategory>();
  const deleteDialog = useDialogState<TaskCategory>();

  const { data: categories = [], isLoading } = useTaskCategories();
  const deleteMutation = useDeleteTaskCategory();
  const toggleActiveMutation = useToggleTaskCategoryActive();

  const handleToggleActive = (category: TaskCategory) => {
    toggleActiveMutation.mutate({
      categoryId: category.categoryId,
      isActive: !category.isActive,
    });
  };

  const handleEdit = (category: TaskCategory) => {
    editDialog.open(category);
  };

  const handleDelete = (category: TaskCategory) => {
    deleteDialog.open(category);
  };

  const handleDeleteConfirm = () => {
    if (!deleteDialog.id) return;

    deleteMutation.mutate(deleteDialog.id.categoryId, {
      onSuccess: () => {
        deleteDialog.close();
      },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">업무 구분 관리</h1>
          <p className="page-description">업무 구분을 관리하세요</p>
        </div>
        <Button onClick={createDialog.open}>
          <Plus className="h-4 w-4 mr-2" />새 업무 구분
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무 구분 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <StateRenderer
            isLoading={isLoading}
            isEmpty={categories.length === 0}
            emptyMessage="등록된 업무 구분이 없습니다."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업무 구분</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.categoryId}
                    className={!category.isActive ? 'opacity-60' : ''}
                  >
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(category)}
                      >
                        {category.isActive ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(parseISO(category.createdAt), 'yyyy-MM-dd HH:mm', {
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(category)}>
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

      <CreateTaskCategoryDialog
        open={createDialog.isOpen}
        onOpenChange={createDialog.onOpenChange}
      />

      <EditTaskCategoryDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        category={editDialog.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무 구분 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialog.id?.name}" 업무 구분을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
