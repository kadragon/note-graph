// Trace: TASK-024, TASK-025, SPEC-worknote-1, SPEC-worknote-2, SPEC-ui-1, TASK-034, SPEC-todo-2, TASK-051, TASK-052

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { AssigneeSelector } from '@/components/AssigneeSelector';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TODO_STATUS } from '@/constants/todoStatus';
import { useToast } from '@/hooks/use-toast';
import { usePersons } from '@/hooks/usePersons';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useDeleteTodo, useToggleTodo } from '@/hooks/useTodos';
import { useUpdateWorkNote } from '@/hooks/useWorkNotes';
import { API } from '@/lib/api';
import { formatPersonBadge } from '@/lib/utils';
import { EditTodoDialog } from '@/pages/Dashboard/components/EditTodoDialog';
import type { CreateTodoRequest, Todo, TodoStatus, WorkNote } from '@/types/api';
import { groupRecurringTodos } from './groupRecurringTodos';
import { RecurringTodoGroup } from './RecurringTodoGroup';
import { TodoListItem } from './TodoListItem';

// Markdown plugin configurations
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

interface ViewWorkNoteDialogProps {
  workNote: WorkNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to get today's date in YYYY-MM-DD format
const getTodayString = (): string => new Date().toISOString().split('T')[0];

export function ViewWorkNoteDialog({ workNote, open, onOpenChange }: ViewWorkNoteDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editPersonIds, setEditPersonIds] = useState<string[]>([]);

  const [showAddTodo, setShowAddTodo] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDescription, setTodoDescription] = useState('');
  // Set default due date to today in YYYY-MM-DD format
  const [todoDueDate, setTodoDueDate] = useState(getTodayString);

  // Refs for focusing specific sections when entering edit mode
  const categorySectionRef = useRef<HTMLDivElement | null>(null);
  const assigneeSectionRef = useRef<HTMLDivElement | null>(null);

  // Detect system theme preference
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  // Edit todo dialog state
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTodoDialogOpen, setEditTodoDialogOpen] = useState(false);

  // Delete todo confirmation dialog state
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateWorkNote();
  const toggleTodoMutation = useToggleTodo(workNote?.id);
  const deleteTodoMutation = useDeleteTodo(workNote?.id);
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories();
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  // Fetch todos for this work note
  const { data: todos = [], isLoading: todosLoading } = useQuery({
    queryKey: ['work-note-todos', workNote?.id],
    queryFn: () => (workNote ? API.getWorkNoteTodos(workNote.id) : Promise.resolve([])),
    enabled: !!workNote && open,
  });

  // Fetch detailed work note (includes references)
  const { data: detailedWorkNote } = useQuery({
    queryKey: ['work-note-detail', workNote?.id],
    queryFn: () => (workNote ? API.getWorkNote(workNote.id) : Promise.resolve(null)),
    enabled: !!workNote && open,
    staleTime: 30_000,
  });

  const currentWorkNote = detailedWorkNote || workNote;

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

  // Detect and sync with system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateColorMode = (e: MediaQueryListEvent | MediaQueryList) => {
      setColorMode(e.matches ? 'dark' : 'light');
    };

    // Set initial value
    updateColorMode(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', updateColorMode);

    return () => {
      mediaQuery.removeEventListener('change', updateColorMode);
    };
  }, []);

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
      setTodoTitle('');
      setTodoDescription('');
      // Reset due date to today
      setTodoDueDate(getTodayString());
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

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;

    const todoData: CreateTodoRequest = {
      title: todoTitle.trim(),
      description: todoDescription.trim() || undefined,
      dueDate: todoDueDate ? new Date(todoDueDate).toISOString() : undefined,
      repeatRule: 'NONE',
    };

    createTodoMutation.mutate(todoData);
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

  const handleCategoryToggle = (categoryId: string) => {
    setEditCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

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

  if (!currentWorkNote) return null;

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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => enterEditMode()}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="sr-only">수정</span>
                  </Button>
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
            {/* Categories Section */}
            <div>
              <Label className="text-sm font-medium mb-2 block">업무 구분</Label>
              {isEditing ? (
                categoriesLoading ? (
                  <p className="text-sm text-muted-foreground">로딩 중...</p>
                ) : taskCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 업무 구분이 없습니다.</p>
                ) : (
                  <div
                    ref={categorySectionRef}
                    className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto border rounded-md p-3"
                  >
                    {taskCategories.map((category) => (
                      <div key={category.categoryId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-category-${category.categoryId}`}
                          checked={editCategoryIds.includes(category.categoryId)}
                          onCheckedChange={() => handleCategoryToggle(category.categoryId)}
                        />
                        <label
                          htmlFor={`edit-category-${category.categoryId}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )
              ) : (
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
              )}
            </div>

            {/* Assignees Section */}
            <div>
              <Label className="text-sm font-medium mb-2 block">담당자</Label>
              {isEditing ? (
                persons.length === 0 && !personsLoading ? (
                  <p className="text-sm text-muted-foreground">등록된 사람이 없습니다.</p>
                ) : (
                  <div ref={assigneeSectionRef}>
                    <AssigneeSelector
                      persons={persons}
                      selectedPersonIds={editPersonIds}
                      onSelectionChange={setEditPersonIds}
                      isLoading={personsLoading}
                    />
                  </div>
                )
              ) : (
                <div className="flex flex-wrap gap-1">
                  {currentWorkNote.persons && currentWorkNote.persons.length > 0 ? (
                    currentWorkNote.persons.map((person) => (
                      <Badge key={person.personId} variant="outline">
                        {formatPersonBadge({
                          name: person.personName,
                          currentDept: person.currentDept,
                          currentPosition: person.currentPosition,
                        })}
                        {person.role === 'OWNER' && <span className="ml-1 text-xs">(담당)</span>}
                      </Badge>
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
              )}
            </div>

            {/* Dates */}
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

            {/* Content */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">내용</h3>
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="마크다운 형식으로 작성하세요"
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    마크다운 형식 지원: **굵게**, *기울임*, # 제목, - 목록 등
                  </p>
                </div>
              ) : (
                <div
                  className="prose prose-sm leading-relaxed max-w-none border rounded-md p-4 bg-gray-50 dark:bg-gray-800"
                  data-color-mode={colorMode}
                >
                  <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
                    {currentWorkNote.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* References */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">참고한 업무노트</h3>
              {currentWorkNote.relatedWorkNotes && currentWorkNote.relatedWorkNotes.length > 0 ? (
                <div className="space-y-2">
                  {currentWorkNote.relatedWorkNotes.map((ref) => (
                    <div
                      key={ref.relatedWorkId}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div>
                        <p className="font-medium">{ref.relatedWorkTitle || ref.relatedWorkId}</p>
                        <p className="text-xs text-muted-foreground">ID: {ref.relatedWorkId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">저장된 참고 업무노트가 없습니다.</p>
              )}
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
                <form onSubmit={handleAddTodo} className="mb-4 p-3 border rounded-md space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="todo-title">할일 제목</Label>
                    <Input
                      id="todo-title"
                      value={todoTitle}
                      onChange={(e) => setTodoTitle(e.target.value)}
                      placeholder="할일을 입력하세요"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="todo-description">설명 (선택사항)</Label>
                    <Textarea
                      id="todo-description"
                      value={todoDescription}
                      onChange={(e) => setTodoDescription(e.target.value)}
                      placeholder="상세 설명"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="todo-due-date">마감일 (선택사항)</Label>
                    <Input
                      id="todo-due-date"
                      type="date"
                      value={todoDueDate}
                      onChange={(e) => setTodoDueDate(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={createTodoMutation.isPending} className="w-full">
                    {createTodoMutation.isPending ? '추가 중...' : '추가'}
                  </Button>
                </form>
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
    </>
  );
}
