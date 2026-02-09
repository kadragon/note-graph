// Trace: TASK-D.2

import { AIReferenceList } from '@web/components/ai-reference-list';
import { AssigneeSelector } from '@web/components/assignee-selector';
import { Button } from '@web/components/ui/button';
import { Card } from '@web/components/ui/card';
import { Checkbox } from '@web/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useEnhanceWorkNoteForm } from '@web/hooks/use-enhance-work-note';
import type { EnhanceWorkNoteResponse } from '@web/types/api';
import { CheckCircle2, FileEdit } from 'lucide-react';
import { useEffect } from 'react';

interface EnhancePreviewDialogProps {
  workId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enhanceResponse: EnhanceWorkNoteResponse;
  existingRelatedWorkIds?: string[];
}

export function EnhancePreviewDialog({
  workId,
  open,
  onOpenChange,
  enhanceResponse,
  existingRelatedWorkIds = [],
}: EnhancePreviewDialogProps) {
  const { state, actions, data } = useEnhanceWorkNoteForm(workId, {
    onSuccess: () => {
      onOpenChange(false);
    },
    existingRelatedWorkIds,
  });

  const {
    title,
    content,
    selectedCategoryIds,
    selectedPersonIds,
    references = [],
    selectedReferenceIds = [],
    suggestedNewTodos,
    selectedNewTodoIds,
    existingTodos,
    isSubmitting,
  } = state;

  const {
    setTitle,
    setContent,
    setSelectedPersonIds,
    setSelectedReferenceIds = () => {},
    handleCategoryToggle,
    toggleNewTodo,
    handleSubmit,
    populateFromEnhanceResponse,
    resetForm,
  } = actions;

  const { taskCategories, persons, categoriesLoading, personsLoading } = data;

  // Populate form when dialog opens with enhance response
  useEffect(() => {
    if (open && enhanceResponse) {
      populateFromEnhanceResponse(enhanceResponse);
    }
  }, [open, enhanceResponse, populateFromEnhanceResponse]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            AI 업데이트 미리보기
          </DialogTitle>
          <DialogDescription>
            AI가 생성한 향상된 내용을 검토하고 수정한 후 적용하세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="업무노트 제목"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>업무 구분 (선택사항)</Label>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            ) : taskCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 업무 구분이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto border rounded-md p-3">
                {taskCategories.map((category) => (
                  <div key={category.categoryId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${category.categoryId}`}
                      checked={selectedCategoryIds.includes(category.categoryId)}
                      onCheckedChange={() => handleCategoryToggle(category.categoryId)}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor={`cat-${category.categoryId}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {category.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>담당자 (선택사항)</Label>
            {persons.length === 0 && !personsLoading ? (
              <p className="text-sm text-muted-foreground">등록된 사람이 없습니다.</p>
            ) : (
              <AssigneeSelector
                persons={persons}
                selectedPersonIds={selectedPersonIds}
                onSelectionChange={setSelectedPersonIds}
                isLoading={personsLoading}
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="업무노트 내용"
              className="min-h-[200px]"
              disabled={isSubmitting}
              required
            />
          </div>

          {references.length > 0 && (
            <AIReferenceList
              references={references}
              selectedIds={selectedReferenceIds}
              onSelectionChange={setSelectedReferenceIds}
            />
          )}

          {/* Existing Todos - Read Only */}
          {existingTodos.length > 0 && (
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                기존 할일 (유지됨)
              </Label>
              <Card className="p-3 bg-muted/50">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {existingTodos.map((todo) => (
                    <li key={todo.todoId} className="flex items-start">
                      <span className="mr-2">•</span>
                      <div className="flex-1">
                        <div className="font-medium">{todo.title}</div>
                        {todo.description && (
                          <div className="text-xs mt-0.5">{todo.description}</div>
                        )}
                        {todo.dueDate && <div className="text-xs mt-0.5">마감: {todo.dueDate}</div>}
                        <div className="text-xs mt-0.5">
                          상태: {todo.status === 'COMPLETED' ? '완료' : '진행중'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* New Suggested Todos - Selectable */}
          {suggestedNewTodos.length > 0 && (
            <div className="grid gap-2">
              <Label>추가될 할일 (선택)</Label>
              <Card className="p-3">
                <ul className="space-y-3">
                  {suggestedNewTodos.map((todo) => (
                    <li key={todo.uiId} className="flex items-start space-x-3">
                      <Checkbox
                        id={`todo-${todo.uiId}`}
                        checked={selectedNewTodoIds.includes(todo.uiId)}
                        onCheckedChange={() => toggleNewTodo(todo.uiId)}
                        disabled={isSubmitting}
                        className="mt-0.5"
                      />
                      <label htmlFor={`todo-${todo.uiId}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium">{todo.title}</div>
                        {todo.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {todo.description}
                          </div>
                        )}
                        {todo.dueDate && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            마감: {todo.dueDate}
                          </div>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '적용 중...' : '적용'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
