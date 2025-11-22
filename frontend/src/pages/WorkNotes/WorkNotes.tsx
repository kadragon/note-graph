import { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { useWorkNotesWithStats, useDeleteWorkNote } from '@/hooks/useWorkNotes';
import { WorkNotesTable } from './components/WorkNotesTable';
import { CreateWorkNoteDialog } from './components/CreateWorkNoteDialog';
import { CreateFromPDFDialog } from './components/CreateFromPDFDialog';
import { CreateFromTextDialog } from './components/CreateFromTextDialog';
import { ViewWorkNoteDialog } from './components/ViewWorkNoteDialog';
import type { WorkNote } from '@/types/api';

export default function WorkNotes() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkNote, setSelectedWorkNote] = useState<WorkNote | null>(
    null
  );
  const [workNoteToDelete, setWorkNoteToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'completed'>('active');

  const { data: workNotes = [], isLoading } = useWorkNotesWithStats();
  const deleteMutation = useDeleteWorkNote();

  // Filter work notes by completion status
  const { activeWorkNotes, pendingWorkNotes, completedWorkNotes } = useMemo(() => {
    const active = workNotes.filter(
      wn => wn.todoStats.total === 0 || wn.todoStats.remaining > 0
    );
    // 대기중: 대기일이 아직 도래하지 않은 할일이 있는 업무노트
    const pending = workNotes.filter(
      wn => wn.todoStats.pending > 0
    );
    const completed = workNotes.filter(
      wn => wn.todoStats.total > 0 && wn.todoStats.remaining === 0
    );

    return { activeWorkNotes: active, pendingWorkNotes: pending, completedWorkNotes: completed };
  }, [workNotes]);

  // Update selectedWorkNote when workNotes data changes (after edit/update)
  useEffect(() => {
    if (selectedWorkNote && workNotes.length > 0) {
      const updatedWorkNote = workNotes.find(
        (wn) => wn.id === selectedWorkNote.id
      );
      if (updatedWorkNote) {
        setSelectedWorkNote(updatedWorkNote);
      } else {
        // Clear selection if note was deleted
        setSelectedWorkNote(null);
        setViewDialogOpen(false);
      }
    }
  }, [workNotes, selectedWorkNote?.id]);

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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">업무노트</h1>
          <p className="page-description">업무노트를 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTextDialogOpen(true)}>
            <FileEdit className="h-4 w-4 mr-2" />
            텍스트로 만들기
          </Button>
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'pending' | 'completed')}>
              <TabsList className="mb-4">
                <TabsTrigger value="active">
                  진행 중 ({activeWorkNotes.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  대기중 ({pendingWorkNotes.length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  완료됨 ({completedWorkNotes.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                <WorkNotesTable
                  workNotes={activeWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                />
              </TabsContent>

              <TabsContent value="pending">
                <WorkNotesTable
                  workNotes={pendingWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                />
              </TabsContent>

              <TabsContent value="completed">
                <WorkNotesTable
                  workNotes={completedWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <CreateWorkNoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <CreateFromTextDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
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
              onClick={() => void handleDeleteConfirm()}
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
