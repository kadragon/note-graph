import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import type { Person, TaskCategory } from '@web/types/api';
import type { RefObject } from 'react';

interface WorkNoteEditFormProps {
  title?: string;
  content: string;
  categoryIds: string[];
  personIds: string[];
  categories: TaskCategory[];
  persons: Person[];
  onChange: (
    field: 'title' | 'content' | 'categoryIds' | 'personIds',
    value: string | string[]
  ) => void;
  categoriesLoading: boolean;
  personsLoading: boolean;
  categorySectionRef?: RefObject<HTMLDivElement | null>;
  assigneeSectionRef?: RefObject<HTMLDivElement | null>;
  showTitle?: boolean;
}

export function WorkNoteEditForm({
  title = '',
  content,
  categoryIds,
  personIds,
  categories,
  persons,
  onChange,
  categoriesLoading,
  personsLoading,
  categorySectionRef,
  assigneeSectionRef,
  showTitle = true,
}: WorkNoteEditFormProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      {showTitle && (
        <div>
          <Input
            value={title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="제목"
            className="text-xl font-semibold"
          />
        </div>
      )}

      {/* Categories Section */}
      <div>
        <Label className="text-sm font-medium mb-2 block">업무 구분</Label>
        <CategorySelector
          categories={categories}
          selectedIds={categoryIds}
          onSelectionChange={(ids) => onChange('categoryIds', ids)}
          isLoading={categoriesLoading}
          idPrefix="edit-category"
          containerRef={categorySectionRef}
        />
      </div>

      {/* Assignees Section */}
      <div>
        <Label className="text-sm font-medium mb-2 block">담당자</Label>
        {persons.length === 0 && !personsLoading ? (
          <p className="text-sm text-muted-foreground">등록된 사람이 없습니다.</p>
        ) : (
          <div ref={assigneeSectionRef}>
            <AssigneeSelector
              persons={persons}
              selectedPersonIds={personIds}
              onSelectionChange={(ids) => onChange('personIds', ids)}
              isLoading={personsLoading}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">내용</h3>
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => onChange('content', e.target.value)}
            placeholder="마크다운 형식으로 작성하세요"
            className="min-h-[400px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            마크다운 형식 지원: **굵게**, *기울임*, # 제목, - 목록 등
          </p>
        </div>
      </div>
    </div>
  );
}
