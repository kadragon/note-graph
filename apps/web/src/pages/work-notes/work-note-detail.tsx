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
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { TODO_STATUS } from '@web/constants/todo-status';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useDeleteTodo, useToggleTodo } from '@web/hooks/use-todos';
import { useWorkNoteGroups } from '@web/hooks/use-work-note-groups';
import { useUpdateWorkNote } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { buildAssigneeEmailTemplate } from '@web/lib/assignee-email-template';
import { formatDateTimeInKstOrFallback } from '@web/lib/date-format';
import { invalidateMany, workNoteRelatedKeys } from '@web/lib/query-invalidation';
import { qk } from '@web/lib/query-keys';
import { formatPersonBadge, toUTCISOString } from '@web/lib/utils';
import { EditTodoDialog } from '@web/pages/dashboard/components/edit-todo-dialog';
import type {
  CreateTodoRequest,
  EnhanceWorkNoteResponse,
  Todo,
  TodoStatus,
  WorkNote,
} from '@web/types/api';
import { ArrowLeft, Copy, Edit2, Loader2, Save, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupRecurringTodos } from './components/group-recurring-todos';

const LazyMarkdown = lazy(() =>
  import('@web/components/lazy-markdown').then((mod) => ({ default: mod.LazyMarkdown }))
);

import { EnhancePreviewDialog } from './components/enhance-preview-dialog';
import { EnhanceWorkNoteDialog } from './components/enhance-work-note-dialog';
import { RecurringTodoGroup } from './components/recurring-todo-group';
import { TodoCreationForm } from './components/todo-creation-form';
import { TodoListItem } from './components/todo-list-item';
import { WorkNoteEditForm } from './components/work-note-edit-form';
import { WorkNoteFileList } from './components/work-note-file-list';

type RelatedWorkNote = NonNullable<WorkNote['relatedWorkNotes']>[number];

export default function WorkNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editPersonIds, setEditPersonIds] = useState<string[]>([]);
  const [editRelatedWorkNotes, setEditRelatedWorkNotes] = useState<RelatedWorkNote[]>([]);

  const [showAddTodo, setShowAddTodo] = useState(false);

  const categorySectionRef = useRef<HTMLDivElement | null>(null);
  const assigneeSectionRef = useRef<HTMLDivElement | null>(null);

  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTodoDialogOpen, setEditTodoDialogOpen] = useState(false);
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);

  const [enhanceInputOpen, setEnhanceInputOpen] = useState(false);
  const [enhancePreviewOpen, setEnhancePreviewOpen] = useState(false);
  const [enhanceResponse, setEnhanceResponse] = useState<EnhanceWorkNoteResponse | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateWorkNote();
  const toggleTodoMutation = useToggleTodo(id);
  const deleteTodoMutation = useDeleteTodo(id);
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: workNoteGroups = [], isLoading: groupsLoading } = useWorkNoteGroups(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  const { data: workNote, isLoading } = useQuery({
    queryKey: qk.workNoteDetail(id),
    queryFn: () => (id ? API.getWorkNote(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: allTodos = [], isLoading: todosLoading } = useQuery({
    queryKey: qk.workNoteTodos(id),
    queryFn: () => (id ? API.getTodos('all', undefined, [id]) : Promise.resolve([])),
    enabled: !!id,
  });

  const todos = useMemo(
    () =>
      allTodos.filter((t) => t.status !== TODO_STATUS.ON_HOLD && t.status !== TODO_STATUS.STOPPED),
    [allTodos]
  );

  const relatedWorkNotesLoaded = !isLoading;
  const relatedWorkNotesToDisplay = isEditing
    ? editRelatedWorkNotes
    : workNote?.relatedWorkNotes || [];
  const hasGroups = (workNote?.groups?.length ?? 0) > 0;
  const hasRelatedWorkNotes = relatedWorkNotesToDisplay.length > 0;
  const hasRelatedMeetingMinutes = (workNote?.relatedMeetingMinutes?.length ?? 0) > 0;
  const showRelatedWorkNotesSection = isEditing || hasRelatedWorkNotes;
  const showMeetingSection = isEditing || hasRelatedMeetingMinutes;

  const editableCategories = useMemo(() => {
    if (!workNote) {
      return taskCategories;
    }
    const activeCategoryIds = new Set(taskCategories.map((category) => category.categoryId));
    const inactiveSelectedCategories = (workNote.categories || [])
      .filter((category) => !activeCategoryIds.has(category.categoryId))
      .map((category) => ({ ...category, isActive: false }));
    return [...taskCategories, ...inactiveSelectedCategories];
  }, [workNote, taskCategories]);

  const resetForm = useCallback(() => {
    if (workNote) {
      setEditTitle(workNote.title);
      setEditContent(workNote.content);
      setEditCategoryIds(workNote.categories?.map((c) => c.categoryId) || []);
      setEditGroupIds(workNote.groups?.map((g) => g.groupId) || []);
      setEditPersonIds(workNote.persons?.map((p) => p.personId) || []);
      setEditRelatedWorkNotes(workNote.relatedWorkNotes || []);
    }
  }, [workNote]);

  useEffect(() => {
    if (workNote) {
      resetForm();
    }
  }, [workNote, resetForm]);

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
      } catch {
        toast({
          variant: 'destructive',
          title: '복사에 실패했습니다.',
          description: '다시 시도해주세요.',
        });
      }
    },
    [toast]
  );

  const createTodoMutation = useMutation({
    mutationFn: (data: CreateTodoRequest) =>
      id ? API.createWorkNoteTodo(id, data) : Promise.reject(new Error('No work note')),
    onSuccess: () => {
      invalidateMany(
        queryClient,
        workNoteRelatedKeys(id, {
          includeTodos: true,
          includeWorkNotes: false,
          includeWorkNotesWithStats: true,
          includeWorkNoteTodos: true,
        })
      );
      setShowAddTodo(false);
      toast({ title: '성공', description: '할일이 추가되었습니다.' });
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
    if (currentStatus === TODO_STATUS.ON_HOLD || currentStatus === TODO_STATUS.STOPPED) {
      return;
    }
    const newStatus: TodoStatus =
      currentStatus === TODO_STATUS.COMPLETED ? TODO_STATUS.IN_PROGRESS : TODO_STATUS.COMPLETED;
    toggleTodoMutation.mutate({ id: todoId, status: newStatus });
  };

  const handleFormFieldChange = useCallback(
    (
      field: 'title' | 'content' | 'categoryIds' | 'groupIds' | 'personIds',
      value: string | string[]
    ) => {
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
        case 'groupIds':
          setEditGroupIds(value as string[]);
          break;
        case 'personIds':
          setEditPersonIds(value as string[]);
          break;
      }
    },
    []
  );

  const handleRemoveRelatedWorkNote = useCallback((relatedWorkId: string) => {
    setEditRelatedWorkNotes((prev) => prev.filter((note) => note.relatedWorkId !== relatedWorkId));
  }, []);

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
      window.requestAnimationFrame(() => {
        let focusSuccess = false;
        if (focusTarget === 'category') {
          focusSuccess = focusFirstInteractiveElement(categorySectionRef.current);
        } else if (focusTarget === 'assignee') {
          focusSuccess = focusFirstInteractiveElement(assigneeSectionRef.current);
        }
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
    if (!workNote || !editTitle.trim() || !editContent.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '제목과 내용을 입력해주세요.',
      });
      return;
    }
    try {
      const relatedWorkIds = relatedWorkNotesLoaded
        ? editRelatedWorkNotes.map((note) => note.relatedWorkId)
        : undefined;
      await updateMutation.mutateAsync({
        workId: workNote.id,
        data: {
          title: editTitle.trim(),
          content: editContent.trim(),
          categoryIds: editCategoryIds.length > 0 ? editCategoryIds : undefined,
          groupIds: editGroupIds,
          relatedPersonIds: editPersonIds,
          ...(relatedWorkNotesLoaded ? { relatedWorkIds } : {}),
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

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!workNote) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">업무노트를 찾을 수 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/work-notes')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="page-container space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="제목"
                  className="text-xl font-semibold"
                />
                <p className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
                  생성일: {formatDateTimeInKstOrFallback(workNote.createdAt)} | 수정일:{' '}
                  {formatDateTimeInKstOrFallback(workNote.updatedAt)}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-semibold">{workNote.title}</h1>
                <p className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
                  생성일: {formatDateTimeInKstOrFallback(workNote.createdAt)} | 수정일:{' '}
                  {formatDateTimeInKstOrFallback(workNote.updatedAt)}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

        {/* Edit action bar */}
        {isEditing && (
          <div className="sticky top-0 z-10 flex justify-end gap-2 border-b bg-background pb-3">
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
              groupIds={editGroupIds}
              personIds={editPersonIds}
              categories={editableCategories}
              groups={workNoteGroups}
              persons={persons}
              onChange={handleFormFieldChange}
              categoriesLoading={categoriesLoading}
              groupsLoading={groupsLoading}
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
                  {workNote.categories && workNote.categories.length > 0 ? (
                    workNote.categories.map((category) => (
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

              {/* Groups Section */}
              {hasGroups && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">업무 그룹</Label>
                  <div className="flex flex-wrap gap-1">
                    {workNote.groups?.map((group) => (
                      <Badge key={group.groupId} variant="secondary">
                        {group.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignees Section */}
              <div>
                <Label className="text-sm font-medium mb-2 block">담당자</Label>
                <div className="flex flex-wrap gap-1">
                  {workNote.persons && workNote.persons.length > 0 ? (
                    workNote.persons.map((person) => (
                      <div key={person.personId} className="inline-flex items-center gap-1">
                        <Badge variant="outline">
                          {formatPersonBadge({
                            name: person.personName,
                            personId: person.personId,
                            phoneExt: person.phoneExt,
                            currentDept: person.currentDept,
                            currentPosition: person.currentPosition,
                          })}
                          {person.role === 'OWNER' && <span className="ml-1 text-xs">(담당)</span>}
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
                    <LazyMarkdown>{workNote.content}</LazyMarkdown>
                  </Suspense>
                </div>
              </div>
            </>
          )}

          {/* Related Work Notes */}
          {showRelatedWorkNotesSection && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">참고한 업무노트</h3>
              <div className="rounded-md border bg-muted/30 p-3">
                {hasRelatedWorkNotes ? (
                  <div className="flex flex-wrap gap-2">
                    {relatedWorkNotesToDisplay.map((ref) => (
                      <div
                        key={ref.relatedWorkId}
                        className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        <a
                          href={`/work-notes/${ref.relatedWorkId}`}
                          className="max-w-[240px] truncate font-medium hover:underline"
                        >
                          {ref.relatedWorkTitle || ref.relatedWorkId}
                        </a>
                        {isEditing && relatedWorkNotesLoaded && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            aria-label="참고 업무노트 삭제"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveRelatedWorkNote(ref.relatedWorkId);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  isEditing && (
                    <p className="text-sm text-muted-foreground">
                      저장된 참고 업무노트가 없습니다.
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Linked Meeting Minutes */}
          {showMeetingSection && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">연결된 회의록</h3>
              <div className="rounded-md border bg-muted/30 p-3">
                {hasRelatedMeetingMinutes ? (
                  <div className="flex flex-wrap gap-2">
                    {workNote.relatedMeetingMinutes?.map((meeting) => (
                      <div
                        key={meeting.meetingId}
                        className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        <a
                          href={`/meeting-minutes/${meeting.meetingId}`}
                          className="max-w-[220px] truncate font-medium hover:underline"
                        >
                          {meeting.topic}
                        </a>
                        <span className="text-xs text-muted-foreground">{meeting.meetingDate}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  isEditing && (
                    <p className="text-sm text-muted-foreground">연결된 회의록이 없습니다.</p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Files Section */}
          <div className="border-t pt-4">
            <WorkNoteFileList workId={workNote.id} createdAt={workNote.createdAt} />
          </div>

          {/* Bottom Edit Actions */}
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
              <TodoCreationForm onSubmit={handleAddTodo} isPending={createTodoMutation.isPending} />
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
      </div>

      <EditTodoDialog
        todo={editTodo}
        open={editTodoDialogOpen}
        onOpenChange={setEditTodoDialogOpen}
        workNoteId={workNote.id}
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

      <EnhanceWorkNoteDialog
        workId={workNote.id}
        open={enhanceInputOpen}
        onOpenChange={setEnhanceInputOpen}
        onEnhanceSuccess={handleEnhanceSuccess}
      />

      {enhanceResponse && (
        <EnhancePreviewDialog
          workId={workNote.id}
          open={enhancePreviewOpen}
          onOpenChange={handleEnhancePreviewClose}
          enhanceResponse={enhanceResponse}
          existingRelatedWorkIds={
            relatedWorkNotesLoaded
              ? (workNote.relatedWorkNotes || []).map((rw) => rw.relatedWorkId)
              : undefined
          }
        />
      )}
    </>
  );
}
