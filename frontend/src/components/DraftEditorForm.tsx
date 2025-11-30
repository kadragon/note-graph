// Trace: SPEC-worknote-1, TASK-032
import { Trash2 } from 'lucide-react';
import { AIReferenceList } from '@/components/AIReferenceList';
import { AssigneeSelector } from '@/components/AssigneeSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AIDraftFormActions, AIDraftFormData, AIDraftFormState } from '@/hooks/useAIDraftForm';

interface DraftEditorFormProps {
  state: AIDraftFormState;
  actions: AIDraftFormActions;
  data: AIDraftFormData;
  onCancel: () => void;
  onReset?: () => void;
  resetLabel?: string;
}

export function DraftEditorForm({
  state,
  actions,
  data,
  onCancel,
  onReset,
  resetLabel = '다시 입력',
}: DraftEditorFormProps) {
  const {
    title,
    content,
    selectedCategoryIds,
    selectedPersonIds,
    suggestedTodos,
    references,
    selectedReferenceIds,
    isSubmitting,
  } = state;

  const {
    setTitle,
    setContent,
    setSelectedPersonIds,
    handleCategoryToggle,
    handleRemoveTodo,
    setSelectedReferenceIds,
    handleSubmit,
  } = actions;

  const { taskCategories, persons, categoriesLoading, personsLoading } = data;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="업무노트 제목을 입력하세요"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label>업무 구분 (선택사항)</Label>
        {categoriesLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : taskCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 업무 구분이 없습니다. 먼저 업무 구분을 추가해주세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto border rounded-md p-3">
            {taskCategories.map((category) => (
              <div key={category.categoryId} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.categoryId}`}
                  checked={selectedCategoryIds.includes(category.categoryId)}
                  onCheckedChange={() => handleCategoryToggle(category.categoryId)}
                />
                <label
                  htmlFor={`category-${category.categoryId}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
          <p className="text-sm text-muted-foreground">
            등록된 사람이 없습니다. 먼저 사람을 추가해주세요.
          </p>
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
          placeholder="업무노트 내용을 입력하세요"
          className="min-h-[300px]"
          required
        />
      </div>

      <AIReferenceList
        references={references}
        selectedIds={selectedReferenceIds}
        onSelectionChange={setSelectedReferenceIds}
      />

      {suggestedTodos.length > 0 && (
        <div className="grid gap-2">
          <Label>생성될 할일 (삭제 가능)</Label>
          <Card className="p-3">
            <ul className="space-y-2 text-sm">
              {suggestedTodos.map((todo) => (
                <li key={todo.uiId} className="flex items-start group">
                  <span className="mr-2">•</span>
                  <div className="flex-1">
                    <div className="font-medium">{todo.title}</div>
                    {todo.description && (
                      <div className="text-muted-foreground text-xs mt-0.5">{todo.description}</div>
                    )}
                    {todo.dueDate && (
                      <div className="text-muted-foreground text-xs mt-0.5">
                        마감: {todo.dueDate}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveTodo(todo.uiId)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <DialogFooter className="gap-2">
        {onReset && (
          <Button type="button" variant="outline" onClick={onReset} disabled={isSubmitting}>
            {resetLabel}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '업무노트 저장'}
        </Button>
      </DialogFooter>
    </form>
  );
}
