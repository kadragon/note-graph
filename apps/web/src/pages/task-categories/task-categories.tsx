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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import { useDeleteTaskCategory, useTaskCategories } from '@web/hooks/use-task-categories';
import type { TaskCategory } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CreateTaskCategoryDialog } from './components/create-task-category-dialog';
import { EditTaskCategoryDialog } from './components/edit-task-category-dialog';

export default function TaskCategories() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | null>(null);

  const { data: categories = [], isLoading } = useTaskCategories();
  const deleteMutation = useDeleteTaskCategory();

  const handleEdit = (category: TaskCategory) => {
    setSelectedCategory(category);
    setEditDialogOpen(true);
  };

  const handleDelete = (category: TaskCategory) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedCategory) return;

    deleteMutation.mutate(selectedCategory.categoryId, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedCategory(null);
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
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />새 업무 구분
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무 구분 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">등록된 업무 구분이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업무 구분</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.categoryId}>
                    <TableCell className="font-medium">{category.name}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <CreateTaskCategoryDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <EditTaskCategoryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        category={selectedCategory}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무 구분 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedCategory?.name}" 업무 구분을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
