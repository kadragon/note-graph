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
import { useSuggestDeadlineAdjustments } from '@web/hooks/use-deadline-adjustment';
import { useDialogState } from '@web/hooks/use-dialog-state';
import { useToast } from '@web/hooks/use-toast';
import { useDeleteWorkNote, useWorkNotesWithStats } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import type { DeadlineSuggestion, WorkNoteWithStats } from '@web/types/api';
import type { Todo } from '@web/types/models/todo';
import { CalendarClock, FileEdit, FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DeadlineAdjustmentDialog } from './components/deadline-adjustment-dialog';
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
  const navigate = useNavigate();
  const deleteDialog = useDialogState<string>();
  const [activeTab, setActiveTab] = useState<WorkNoteTab>('active');
  const [completedYearFilter, setCompletedYearFilter] = useState<CompletedYearFilter>(
    String(currentYear) as CompletedYearFilter
  );
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: workNotes = [], isLoading, error } = useWorkNotesWithStats();
  const suggestMutation = useSuggestDeadlineAdjustments();
  const { toast } = useToast();

  const [deadlineSuggestions, setDeadlineSuggestions] = useState<DeadlineSuggestion[] | null>(null);
  const [deadlineTodos, setDeadlineTodos] = useState<Todo[]>([]);

  const handleDeadlineAdjust = async () => {
    let withDueDate: Todo[];
    try {
      const todos = await API.getTodos('remaining');
      withDueDate = todos.filter((t) => t.dueDate);
    } catch {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '할일 목록을 불러오는데 실패했습니다.',
      });
      return;
    }

    if (withDueDate.length === 0) {
      toast({
        title: '알림',
        description: '조정할 할일이 없습니다. (마감일이 있는 진행 중 할일이 없음)',
      });
      return;
    }

    setDeadlineTodos(withDueDate);

    try {
      const result = await suggestMutation.mutateAsync(
        withDueDate.map((t) => ({
          todoId: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.dueDate!,
          workTitle: t.workTitle,
          workCategory: t.workCategory,
        }))
      );

      if (result.suggestions.length === 0) {
        toast({
          title: '알림',
          description: 'AI가 조정할 사항을 찾지 못했습니다.',
        });
        return;
      }

      setDeadlineSuggestions(result.suggestions);
    } catch {
      // Error is handled by the mutation's onError
    }
  };

  // Handle ?id=xxx query param — redirect to new URL
  const workNoteIdFromUrl = searchParams.get('id');
  useEffect(() => {
    if (workNoteIdFromUrl && !isLoading) {
      setSearchParams({}, { replace: true });
      navigate(`/work-notes/${workNoteIdFromUrl}`, { replace: true });
    }
  }, [workNoteIdFromUrl, isLoading, setSearchParams, navigate]);

  const deleteMutation = useDeleteWorkNote();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

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

  const handleView = (workNote: WorkNoteWithStats) => {
    navigate(`/work-notes/${workNote.id}`);
  };

  const handleDeleteClick = (workNoteId: string) => {
    deleteDialog.open(workNoteId);
  };

  const handleDeleteConfirm = () => {
    if (!deleteDialog.id) return;

    deleteMutation.mutate(deleteDialog.id, {
      onSuccess: () => {
        deleteDialog.close();
      },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">업무노트</h1>
          <p className="page-description">업무노트를 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDeadlineAdjust}
            disabled={suggestMutation.isPending}
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            {suggestMutation.isPending ? '분석 중...' : '일정 일괄 조정'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/work-notes/new/from-text')}>
            <FileEdit className="h-4 w-4 mr-2" />
            텍스트로 만들기
          </Button>
          <Button variant="outline" onClick={() => navigate('/work-notes/new/from-pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            PDF로 만들기
          </Button>
          <Button onClick={() => navigate('/work-notes/new')}>
            <Plus className="h-4 w-4 mr-2" />새 업무노트
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무노트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <StateRenderer isLoading={isLoading} isEmpty={false} error={error}>
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

      {deadlineSuggestions && (
        <DeadlineAdjustmentDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeadlineSuggestions(null);
          }}
          suggestions={deadlineSuggestions}
          todos={deadlineTodos}
        />
      )}

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
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
              autoFocus
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
