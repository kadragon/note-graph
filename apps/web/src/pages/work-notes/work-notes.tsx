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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { useDeleteWorkNote, useWorkNotesWithStats } from '@web/hooks/use-work-notes';
import type { WorkNote, WorkNoteWithStats } from '@web/types/api';
import { FileEdit, FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CreateFromPDFDialog } from './components/create-from-pdf-dialog';
import { CreateFromTextDialog } from './components/create-from-text-dialog';
import { CreateWorkNoteDialog } from './components/create-work-note-dialog';
import { ViewWorkNoteDialog } from './components/view-work-note-dialog';
import { type SortDirection, type SortKey, WorkNotesTable } from './components/work-notes-table';

export default function WorkNotes() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkNote, setSelectedWorkNote] = useState<WorkNote | null>(null);
  const [workNoteToDelete, setWorkNoteToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'completed'>('active');
  const [sortKey, setSortKey] = useState<SortKey>('category');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data: workNotes = [], isLoading } = useWorkNotesWithStats();
  const deleteMutation = useDeleteWorkNote();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter work notes by completion status
  const { activeWorkNotes, pendingWorkNotes, completedWorkNotes } = useMemo(() => {
    const sortWorkNotes = (a: WorkNoteWithStats, b: WorkNoteWithStats) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      const getValue = (wn: WorkNoteWithStats) => {
        switch (sortKey) {
          case 'category':
            return wn.categories?.[0]?.name ?? '';
          case 'dueDate':
            return wn.latestTodoDate ? new Date(wn.latestTodoDate).getTime() : Number.MAX_VALUE;
          case 'title':
            return wn.title;
          case 'assignee':
            return wn.persons?.[0]?.personName ?? '';
          case 'todo':
            return wn.todoStats.remaining;
          case 'createdAt':
            return new Date(wn.createdAt).getTime();
          default:
            return '';
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB, 'ko') * direction;
      }
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }
      return 0;
    };

    // 진행 중: 할일이 없거나 현재 활성화된 할일이 있는 업무노트
    const active = workNotes
      .filter((wn) => wn.todoStats.total === 0 || wn.todoStats.remaining > 0)
      .sort(sortWorkNotes);
    // 대기중: 남은 할일이 없고 대기 중인 할일만 있는 업무노트
    const pending = workNotes
      .filter((wn) => wn.todoStats.remaining === 0 && wn.todoStats.pending > 0)
      .sort(sortWorkNotes);
    const completed = workNotes
      .filter(
        (wn) => wn.todoStats.total > 0 && wn.todoStats.remaining === 0 && wn.todoStats.pending === 0
      )
      .sort(sortWorkNotes);

    return { activeWorkNotes: active, pendingWorkNotes: pending, completedWorkNotes: completed };
  }, [workNotes, sortKey, sortDirection]);

  // Update selectedWorkNote when workNotes data changes (after edit/update)
  useEffect(() => {
    if (selectedWorkNote && workNotes.length > 0) {
      const updatedWorkNote = workNotes.find((wn) => wn.id === selectedWorkNote.id);
      if (updatedWorkNote) {
        setSelectedWorkNote(updatedWorkNote);
      } else {
        // Clear selection if note was deleted
        setSelectedWorkNote(null);
        setViewDialogOpen(false);
      }
    }
  }, [workNotes, selectedWorkNote?.id, selectedWorkNote]);

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
            <Plus className="h-4 w-4 mr-2" />새 업무노트
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
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'active' | 'pending' | 'completed')}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="active">진행 중 ({activeWorkNotes.length})</TabsTrigger>
                <TabsTrigger value="pending">대기중 ({pendingWorkNotes.length})</TabsTrigger>
                <TabsTrigger value="completed">완료됨 ({completedWorkNotes.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                <WorkNotesTable
                  workNotes={activeWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TabsContent>

              <TabsContent value="pending">
                <WorkNotesTable
                  workNotes={pendingWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TabsContent>

              <TabsContent value="completed">
                <WorkNotesTable
                  workNotes={completedWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <CreateWorkNoteDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <CreateFromTextDialog open={textDialogOpen} onOpenChange={setTextDialogOpen} />

      <CreateFromPDFDialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen} />

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
