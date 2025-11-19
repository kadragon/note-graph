import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useWorkNotes, useDeleteWorkNote } from '@/hooks/useWorkNotes';
import { WorkNotesTable } from './components/WorkNotesTable';
import { CreateWorkNoteDialog } from './components/CreateWorkNoteDialog';
import { CreateFromPDFDialog } from './components/CreateFromPDFDialog';
import { ViewWorkNoteDialog } from './components/ViewWorkNoteDialog';
import type { WorkNote } from '@/types/api';

export default function WorkNotes() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkNote, setSelectedWorkNote] = useState<WorkNote | null>(
    null
  );
  const [workNoteToDelete, setWorkNoteToDelete] = useState<string | null>(null);

  const { data: workNotes = [], isLoading } = useWorkNotes();
  const deleteMutation = useDeleteWorkNote();

  const handleView = (workNote: WorkNote) => {
    setSelectedWorkNote(workNote);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (workNoteId: string) => {
    setWorkNoteToDelete(workNoteId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (workNoteToDelete) {
      await deleteMutation.mutateAsync(workNoteToDelete);
      setDeleteDialogOpen(false);
      setWorkNoteToDelete(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">업무노트</h1>
          <p className="text-gray-600 mt-1">업무노트를 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPdfDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            PDF로 만들기
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            새 업무노트
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무노트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <WorkNotesTable
              workNotes={workNotes}
              onView={handleView}
              onDelete={handleDeleteClick}
            />
          )}
        </CardContent>
      </Card>

      <CreateWorkNoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <CreateFromPDFDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
      />

      <ViewWorkNoteDialog
        workNote={selectedWorkNote}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무노트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 업무노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
