// Trace: TASK-024, TASK-025, SPEC-worknote-1, SPEC-worknote-2, SPEC-ui-1, TASK-034, SPEC-todo-2, TASK-051, TASK-052, SPEC-worknote-email-copy-001, TASK-0071

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { TODO_STATUS } from '@web/constants/todo-status';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useDeleteTodo, useToggleTodo } from '@web/hooks/use-todos';
import { useUpdateWorkNote } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { buildAssigneeEmailTemplate } from '@web/lib/assignee-email-template';
import { formatPersonBadge, toUTCISOString } from '@web/lib/utils';
import { EditTodoDialog } from '@web/pages/dashboard/components/edit-todo-dialog';
import type {
  CreateTodoRequest,
  EnhanceWorkNoteResponse,
  Todo,
  TodoStatus,
  WorkNote,
} from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Copy, Edit2, Save, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupRecurringTodos } from './group-recurring-todos';

// Lazy load markdown component for bundle size optimization
const LazyMarkdown = lazy(() =>
  import('@web/components/lazy-markdown').then((mod) => ({ default: mod.LazyMarkdown }))
);

import { EnhancePreviewDialog } from './enhance-preview-dialog';
import { EnhanceWorkNoteDialog } from './enhance-work-note-dialog';
import { RecurringTodoGroup } from './recurring-todo-group';
import { TodoCreationForm } from './todo-creation-form';
import { TodoListItem } from './todo-list-item';
import { WorkNoteEditForm } from './work-note-edit-form';
import { WorkNoteFileList } from './work-note-file-list';

interface ViewWorkNoteDialogProps {
  workNote: WorkNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
}

export function ViewWorkNoteDialog({
  workNote,
  open,
  onOpenChange,
  loading = false,
}: ViewWorkNoteDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editPersonIds, setEditPersonIds] = useState<string[]>([]);

  const [showAddTodo, setShowAddTodo] = useState(false);

  // Refs for focusing specific sections when entering edit mode
  const categorySectionRef = useRef<HTMLDivElement | null>(null);
  const assigneeSectionRef = useRef<HTMLDivElement | null>(null);

  // Edit todo dialog state
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTodoDialogOpen, setEditTodoDialogOpen] = useState(false);

  // Delete todo confirmation dialog state
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);

  // Enhance dialog states
  const [enhanceInputOpen, setEnhanceInputOpen] = useState(false);
  const [enhancePreviewOpen, setEnhancePreviewOpen] = useState(false);
  const [enhanceResponse, setEnhanceResponse] = useState<EnhanceWorkNoteResponse | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateWorkNote();
  const toggleTodoMutation = useToggleTodo(workNote?.id);
  const deleteTodoMutation = useDeleteTodo(workNote?.id);
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  // Fetch todos for this work note
  const { data: todos = [], isLoading: todosLoading } = useQuery({
    queryKey: ['work-note-todos', workNote?.id],
    queryFn: () => (workNote ? API.getTodos('all', undefined, [workNote.id]) : Promise.resolve([])),
    enabled: !!workNote && open,
  });

  // Fetch detailed work note (includes references)
  // Use placeholderData to show list data immediately while fetching detail
  const { data: detailedWorkNote } = useQuery({
    queryKey: ['work-note-detail', workNote?.id],
    queryFn: () => (workNote ? API.getWorkNote(workNote.id) : Promise.resolve(null)),
    enabled: !!workNote && open,
    staleTime: 30_000,
    placeholderData: workNote ?? undefined,
  });

  // Fallback to list workNote when detail fetch fails (network error, etc.)
  const currentWorkNote = detailedWorkNote ?? workNote;

  // For editing: show active categories + already selected inactive categories
  const editableCategories = useMemo(() => {
    if (!currentWorkNote) {
      return taskCategories;
    }

    const activeCategoryIds = new Set(taskCategories.map((category) => category.categoryId));
    const inactiveSelectedCategories = (currentWorkNote.categories || [])
      .filter((category) => !activeCategoryIds.has(category.categoryId))
      .map((category) => ({
        ...category,
        isActive: false,
      }));

    return [...taskCategories, ...inactiveSelectedCategories];
  }, [currentWorkNote, taskCategories]);

  // Reset form with current work note data
  const resetForm = useCallback(() => {
    if (currentWorkNote) {
      setEditTitle(currentWorkNote.title);
      setEditContent(currentWorkNote.content);
      setEditCategoryIds(currentWorkNote.categories?.map((c) => c.categoryId) || []);
      setEditPersonIds(currentWorkNote.persons?.map((p) => p.personId) || []);
    }
  }, [currentWorkNote]);

  // Initialize edit form when work note changes
  useEffect(() => {
    if (currentWorkNote && open) {
      resetForm();
    }
  }, [currentWorkNote, open, resetForm]);

  // Reset editing state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  const handleCopyAssigneeEmail = useCallback(
    async (assigneeName: string) => {
      const template = buildAssigneeEmailTemplate(assigneeName);
      if (!navigator.clipboard?.writeText) {
        toast({
          variant: 'destructive',
          title: '클립보드를 사용할 수 없습니다.',
          description: '브라우저 권한을 확인해주세요.',
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(template);
        toast({
          title: '이메일 양식을 복사했습니다.',
          description: `${assigneeName} 담당자용 메일 초안을 클립보드에 저장했어요.`,
        });
      } catch (_error) {
        toast({
          variant: 'destructive',
          title: '복사에 실패했습니다.',
          description: '다시 시도해주세요.',
        });
      }
    },
    [toast]
  );

  // Create todo mutation
  const createTodoMutation = useMutation({
    mutationFn: (data: CreateTodoRequest) =>
      currentWorkNote
        ? API.createWorkNoteTodo(currentWorkNote.id, data)
        : Promise.reject(new Error('No work note')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-note-todos', currentWorkNote?.id] });
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      setShowAddTodo(false);
      toast({
        title: '성공',
        description: '할일이 추가되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '할일을 추가할 수 없습니다.',
      });
    },
  });

  const handleAddTodo = (data: CreateTodoRequest) => {
    createTodoMutation.mutate({
      ...data,
      dueDate: data.dueDate ? toUTCISOString(data.dueDate) : undefined,
      waitUntil: data.waitUntil ? toUTCISOString(data.waitUntil) : undefined,
    });
  };

  const handleToggleTodoStatus = (todoId: string, currentStatus: TodoStatus) => {
    // Only allow toggling between '진행중' and '완료'
    // '보류' and '중단' states should be managed separately
    if (currentStatus === TODO_STATUS.ON_HOLD || currentStatus === TODO_STATUS.STOPPED) {
      return;
    }
    const newStatus: TodoStatus =
      currentStatus === TODO_STATUS.COMPLETED ? TODO_STATUS.IN_PROGRESS : TODO_STATUS.COMPLETED;
    toggleTodoMutation.mutate({ id: todoId, status: newStatus });
  };

  const handleFormFieldChange = useCallback(
    (field: 'title' | 'content' | 'categoryIds' | 'personIds', value: string | string[]) => {
      switch (field) {
        case 'title':
          setEditTitle(value as string);
          break;
        case 'content':
          setEditContent(value as string);
          break;
        case 'categoryIds':
          setEditCategoryIds(value as string[]);
          break;
        case 'personIds':
          setEditPersonIds(value as string[]);
          break;
      }
    },
    []
  );

  const focusFirstInteractiveElement = useCallback((container: HTMLElement | null): boolean => {
    if (!container) return false;
    const focusable = container.querySelector<HTMLElement>(
      'input, button, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
      return true;
    }
    return false;
  }, []);

  const enterEditMode = useCallback(
    (focusTarget?: 'category' | 'assignee') => {
      resetForm();
      setIsEditing(true);
      // Wait for the edit UI to render before focusing
      window.requestAnimationFrame(() => {
        let focusSuccess = false;
        if (focusTarget === 'category') {
          focusSuccess = focusFirstInteractiveElement(categorySectionRef.current);
        } else if (focusTarget === 'assignee') {
          focusSuccess = focusFirstInteractiveElement(assigneeSectionRef.current);
        }

        // If focus failed, show a toast to guide the user
        if (focusTarget && !focusSuccess) {
          toast({
            title: '편집 모드로 전환되었습니다',
            description: '아래로 스크롤하여 필드를 수정하세요.',
            variant: 'default',
          });
        }
      });
    },
    [resetForm, toast, focusFirstInteractiveElement]
  );

  const handleSaveEdit = async () => {
    if (!currentWorkNote || !editTitle.trim() || !editContent.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '제목과 내용을 입력해주세요.',
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        workId: currentWorkNote.id,
        data: {
          title: editTitle.trim(),
          content: editContent.trim(),
          categoryIds: editCategoryIds.length > 0 ? editCategoryIds : undefined,
          // Always send relatedPersonIds (including empty array) to allow clearing all assignees
          relatedPersonIds: editPersonIds,
        },
      });
      setIsEditing(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setIsEditing(false);
  };

  const handleEnhanceSuccess = (response: EnhanceWorkNoteResponse) => {
    setEnhanceResponse(response);
    setEnhanceInputOpen(false);
    setEnhancePreviewOpen(true);
  };

  const handleEnhancePreviewClose = () => {
    setEnhancePreviewOpen(false);
    setEnhanceResponse(null);
  };

  // Show loading state when data is being fetched
  if (loading || !currentWorkNote) {
    if (!open) return null;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl">업무노트</DialogTitle>
            <DialogDescription className="sr-only">업무 노트 로딩 중</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              {isEditing ? (
                <div className="flex-1">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목"
                    className="text-xl font-semibold"
                  />
                </div>
              ) : (
                <DialogTitle className="text-xl">{currentWorkNote.title}</DialogTitle>
              )}
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEnhanceInputOpen(true)}
                      className="h-8 px-2"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      <span className="text-xs">AI로 업데이트</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enterEditMode()}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">수정</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
            <DialogDescription className="sr-only">업무 노트 상세 보기 및 편집</DialogDescription>
          </DialogHeader>

          {isEditing && (
            <div className="sticky top-0 z-10 mb-4 flex justify-end gap-2 border-b bg-background pb-3">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button
                onClick={() => void handleSaveEdit()}
                disabled={updateMutation.isPending}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {isEditing ? (
              <WorkNoteEditForm
                content={editContent}
                categoryIds={editCategoryIds}
                personIds={editPersonIds}
                categories={editableCategories}
                persons={persons}
                onChange={handleFormFieldChange}
                categoriesLoading={categoriesLoading}
                personsLoading={personsLoading}
                categorySectionRef={categorySectionRef}
                assigneeSectionRef={assigneeSectionRef}
                showTitle={false}
              />
            ) : (
              <>
                {/* Categories Section */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">업무 구분</Label>
                  <div className="flex flex-wrap gap-1">
                    {currentWorkNote.categories && currentWorkNote.categories.length > 0 ? (
                      currentWorkNote.categories.map((category) => (
                        <Badge key={category.categoryId} variant="secondary">
                          {category.name}
                        </Badge>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => enterEditMode('category')}
                        className="inline-flex items-center gap-2 rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="업무 구분 추가하기"
                      >
                        <Badge variant="outline">업무 구분 없음</Badge>
                        <span className="text-xs">클릭하여 추가</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Assignees Section */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">담당자</Label>
                  <div className="flex flex-wrap gap-1">
                    {currentWorkNote.persons && currentWorkNote.persons.length > 0 ? (
                      currentWorkNote.persons.map((person) => (
                        <div key={person.personId} className="inline-flex items-center gap-1">
                          <Badge variant="outline">
                            {formatPersonBadge({
                              name: person.personName,
                              personId: person.personId,
                              phoneExt: person.phoneExt,
                              currentDept: person.currentDept,
                              currentPosition: person.currentPosition,
                            })}
                            {person.role === 'OWNER' && (
                              <span className="ml-1 text-xs">(담당)</span>
                            )}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label="담당자 이메일 양식 복사"
                            title="이메일 양식 복사"
                            onClick={() => handleCopyAssigneeEmail(person.personName)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => enterEditMode('assignee')}
                        className="inline-flex items-center gap-2 rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="담당자 지정하기"
                      >
                        <Badge variant="outline">담당자 없음</Badge>
                        <span className="text-xs">클릭하여 지정</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">내용</h3>
                  <div
                    className="prose prose-sm leading-relaxed max-w-none border rounded-md p-4 bg-gray-50"
                    data-testid="lazy-markdown"
                  >
                    <Suspense fallback={<div className="text-muted-foreground">로딩 중...</div>}>
                      <LazyMarkdown>{currentWorkNote.content}</LazyMarkdown>
                    </Suspense>
                  </div>
                </div>
              </>
            )}

            {/* Dates - always visible */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                생성일:{' '}
                {format(parseISO(currentWorkNote.createdAt), 'yyyy년 M월 d일 HH:mm', {
                  locale: ko,
                })}
              </p>
              <p>
                수정일:{' '}
                {format(parseISO(currentWorkNote.updatedAt), 'yyyy년 M월 d일 HH:mm', {
                  locale: ko,
                })}
              </p>
            </div>

            {/* References */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">참고한 업무노트</h3>
              {currentWorkNote.relatedWorkNotes && currentWorkNote.relatedWorkNotes.length > 0 ? (
                <div className="space-y-2">
                  {currentWorkNote.relatedWorkNotes.map((ref) => (
                    <a
                      key={ref.relatedWorkId}
                      href={`/work-notes?id=${ref.relatedWorkId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between border rounded-md p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <p className="font-medium">{ref.relatedWorkTitle || ref.relatedWorkId}</p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">저장된 참고 업무노트가 없습니다.</p>
              )}
            </div>

            {/* Files Section */}
            <div className="border-t pt-4">
              <WorkNoteFileList workId={currentWorkNote.id} createdAt={currentWorkNote.createdAt} />
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
                <Button onClick={() => void handleSaveEdit()} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
              </div>
            )}

            {/* Todos Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">할일 목록</h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddTodo(!showAddTodo)}
                  variant={showAddTodo ? 'outline' : 'default'}
                >
                  {showAddTodo ? '취소' : '할일 추가'}
                </Button>
              </div>

              {showAddTodo && (
                <TodoCreationForm
                  onSubmit={handleAddTodo}
                  isPending={createTodoMutation.isPending}
                />
              )}

              {todosLoading ? (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              ) : todos.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 할일이 없습니다.</p>
              ) : (
                (() => {
                  const grouped = groupRecurringTodos(todos);
                  return (
                    <div className="space-y-3">
                      {/* Recurring todo groups */}
                      {grouped.recurring.map((group) => (
                        <RecurringTodoGroup
                          key={group.groupKey}
                          group={group}
                          onToggleTodo={handleToggleTodoStatus}
                          onEditTodo={(todo) => {
                            setEditTodo(todo);
                            setEditTodoDialogOpen(true);
                          }}
                          onDeleteTodo={(todoId) => setDeleteTodoId(todoId)}
                          togglePending={toggleTodoMutation.isPending}
                          deletePending={deleteTodoMutation.isPending}
                        />
                      ))}

                      {/* Standalone todos (non-recurring) */}
                      {grouped.standalone.map((todo) => (
                        <TodoListItem
                          key={todo.id}
                          todo={todo}
                          onToggle={handleToggleTodoStatus}
                          onEdit={(todo) => {
                            setEditTodo(todo);
                            setEditTodoDialogOpen(true);
                          }}
                          onDelete={(todoId) => setDeleteTodoId(todoId)}
                          togglePending={toggleTodoMutation.isPending}
                          deletePending={deleteTodoMutation.isPending}
                        />
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditTodoDialog
        todo={editTodo}
        open={editTodoDialogOpen}
        onOpenChange={setEditTodoDialogOpen}
        workNoteId={currentWorkNote?.id}
      />

      <AlertDialog open={!!deleteTodoId} onOpenChange={(open) => !open && setDeleteTodoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>할일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 할일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTodoId) {
                  deleteTodoMutation.mutate(deleteTodoId);
                  setDeleteTodoId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {currentWorkNote && (
        <>
          <EnhanceWorkNoteDialog
            workId={currentWorkNote.id}
            open={enhanceInputOpen}
            onOpenChange={setEnhanceInputOpen}
            onEnhanceSuccess={handleEnhanceSuccess}
          />

          {enhanceResponse && (
            <EnhancePreviewDialog
              workId={currentWorkNote.id}
              open={enhancePreviewOpen}
              onOpenChange={handleEnhancePreviewClose}
              enhanceResponse={enhanceResponse}
            />
          )}
        </>
      )}
    </>
  );
}
