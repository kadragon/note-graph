import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { GroupSelector } from '@web/components/group-selector';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { Textarea } from '@web/components/ui/textarea';
import type { Person, TaskCategory, WorkNoteGroup } from '@web/types/api';
import type { RefObject } from 'react';

interface WorkNoteEditFormProps {
  title?: string;
  content: string;
  categoryIds: string[];
  groupIds: string[];
  personIds: string[];
  categories: TaskCategory[];
  groups: WorkNoteGroup[];
  persons: Person[];
  onChange: (
    field: 'title' | 'content' | 'categoryIds' | 'groupIds' | 'personIds',
    value: string | string[]
  ) => void;
  categoriesLoading: boolean;
  groupsLoading: boolean;
  personsLoading: boolean;
  categorySectionRef?: RefObject<HTMLDivElement | null>;
  assigneeSectionRef?: RefObject<HTMLDivElement | null>;
  showTitle?: boolean;
}

export function WorkNoteEditForm({
  title = '',
  content,
  categoryIds,
  groupIds,
  personIds,
  categories,
  groups,
  persons,
  onChange,
  categoriesLoading,
  groupsLoading,
  personsLoading,
  categorySectionRef,
  assigneeSectionRef,
  showTitle = true,
}: WorkNoteEditFormProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">기본 정보</TabsTrigger>
          <TabsTrigger value="content">내용</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          {/* Title */}
          {showTitle && (
            <div>
              <Input
                aria-label="제목"
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

          {/* Groups Section */}
          <div>
            <Label className="text-sm font-medium mb-2 block">업무 그룹</Label>
            <GroupSelector
              groups={groups}
              selectedIds={groupIds}
              onSelectionChange={(ids) => onChange('groupIds', ids)}
              isLoading={groupsLoading}
              idPrefix="edit-group"
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
        </TabsContent>

        <TabsContent value="content" className="space-y-2">
          <h3 className="font-semibold">내용</h3>
          <Textarea
            value={content}
            onChange={(e) => onChange('content', e.target.value)}
            placeholder="마크다운 형식으로 작성하세요"
            className="min-h-[320px] h-[42vh] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            마크다운 형식 지원: **굵게**, *기울임*, # 제목, - 목록 등
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
