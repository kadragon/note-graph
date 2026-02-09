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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { useDeleteWorkNote, useWorkNotesWithStats } from '@web/hooks/use-work-notes';
import type { WorkNoteWithStats } from '@web/types/api';
import { FileEdit, FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreateFromPDFDialog } from './components/create-from-pdf-dialog';
import { CreateFromTextDialog } from './components/create-from-text-dialog';
import { CreateWorkNoteDialog } from './components/create-work-note-dialog';
import { ViewWorkNoteDialog } from './components/view-work-note-dialog';
import { type SortDirection, type SortKey, WorkNotesTable } from './components/work-notes-table';
import {
  type CompletedYearFilter,
  filterCompletedWorkNotesByYear,
  filterWorkNotes,
  getCompletedYears,
} from './lib/filter-work-notes';

type WorkNoteTab = 'active' | 'pending' | 'completed-today' | 'completed-week' | 'completed';

export default function WorkNotes() {
  const currentYear = new Date().getFullYear();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkNote, setSelectedWorkNote] = useState<WorkNoteWithStats | null>(null);
  const [workNoteToDelete, setWorkNoteToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkNoteTab>('active');
  const [completedYearFilter, setCompletedYearFilter] = useState<CompletedYearFilter>(
    String(currentYear) as CompletedYearFilter
  );
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: workNotes = [], isLoading } = useWorkNotesWithStats();

  // Handle ?id=xxx query param to auto-open work note
  const workNoteIdFromUrl = searchParams.get('id');
  useEffect(() => {
    if (workNoteIdFromUrl && !isLoading) {
      const workNote = workNotes.find((wn) => wn.id === workNoteIdFromUrl);
      if (workNote) {
        setSelectedWorkNote(workNote);
        setViewDialogOpen(true);
      }
      setSearchParams({}, { replace: true });
    }
  }, [workNoteIdFromUrl, isLoading, workNotes, setSearchParams]);
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
  const {
    activeWorkNotes,
    pendingWorkNotes,
    completedTodayWorkNotes,
    completedWeekWorkNotes,
    completedAllWorkNotes,
  } = useMemo(
    () => filterWorkNotes(workNotes, sortKey, sortDirection),
    [workNotes, sortKey, sortDirection]
  );
  const completedYears = useMemo(
    () => getCompletedYears(completedAllWorkNotes),
    [completedAllWorkNotes]
  );
  const completedWorkNotes = useMemo(
    () => filterCompletedWorkNotesByYear(completedAllWorkNotes, completedYearFilter),
    [completedAllWorkNotes, completedYearFilter]
  );

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

  const handleView = (workNote: WorkNoteWithStats) => {
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
          <StateRenderer isLoading={isLoading} isEmpty={false}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkNoteTab)}>
              <TabsList className="mb-4 flex flex-wrap gap-2">
                <TabsTrigger value="active">진행 중 ({activeWorkNotes.length})</TabsTrigger>
                <TabsTrigger value="pending">대기중 ({pendingWorkNotes.length})</TabsTrigger>
                <TabsTrigger value="completed-today">
                  완료됨(오늘) ({completedTodayWorkNotes.length})
                </TabsTrigger>
                <TabsTrigger value="completed-week">
                  완료됨(이번주) ({completedWeekWorkNotes.length})
                </TabsTrigger>
                <TabsTrigger value="completed">완료됨 ({completedWorkNotes.length})</TabsTrigger>
              </TabsList>

              {activeTab === 'completed' && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm font-medium">연도:</span>
                  <Select
                    value={completedYearFilter}
                    onValueChange={(value) => setCompletedYearFilter(value as CompletedYearFilter)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {completedYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year === currentYear ? `현재연도 (${year}년)` : `${year}년`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              <TabsContent value="completed-today">
                <WorkNotesTable
                  workNotes={completedTodayWorkNotes}
                  onView={handleView}
                  onDelete={handleDeleteClick}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TabsContent>

              <TabsContent value="completed-week">
                <WorkNotesTable
                  workNotes={completedWeekWorkNotes}
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
          </StateRenderer>
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
