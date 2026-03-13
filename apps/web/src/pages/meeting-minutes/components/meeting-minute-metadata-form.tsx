import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { GroupSelector } from '@web/components/group-selector';
import { Button } from '@web/components/ui/button';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { useToast } from '@web/hooks/use-toast';
import type { Person, TaskCategory, WorkNoteGroup } from '@web/types/api';

interface MeetingMinuteFormData {
  meetingDate: string;
  topic: string;
  detailsRaw: string;
  categoryIds: string[];
  groupIds: string[];
  personIds: string[];
}

interface MeetingMinuteMetadataFormProps {
  formData: MeetingMinuteFormData;
  onFormDataChange: (data: Partial<MeetingMinuteFormData>) => void;
  onNext: () => void;
  onCancel: () => void;
  taskCategories: TaskCategory[];
  categoriesLoading: boolean;
  groups: WorkNoteGroup[];
  groupsLoading: boolean;
  persons: Person[];
  personsLoading: boolean;
  idPrefix: string;
  linkedWorkNoteCount?: number;
}

export function MeetingMinuteMetadataForm({
  formData,
  onFormDataChange,
  onNext,
  onCancel,
  taskCategories,
  categoriesLoading,
  groups,
  groupsLoading,
  persons,
  personsLoading,
  idPrefix,
  linkedWorkNoteCount,
}: MeetingMinuteMetadataFormProps) {
  const { toast } = useToast();

  const handleNext = () => {
    if (!formData.meetingDate || !formData.topic.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '회의일과 토픽을 입력해주세요.',
      });
      return;
    }

    if (formData.personIds.length === 0) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '참석자를 한 명 이상 선택해주세요.',
      });
      return;
    }

    onNext();
  };

  return (
    <div className="grid gap-4">
      {linkedWorkNoteCount !== undefined && (
        <p className="text-sm text-muted-foreground">연결된 업무노트: {linkedWorkNoteCount}건</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-meeting-date`}>회의일</Label>
        <Input
          id={`${idPrefix}-meeting-date`}
          type="date"
          value={formData.meetingDate}
          onChange={(e) => onFormDataChange({ meetingDate: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-meeting-topic`}>토픽</Label>
        <Input
          id={`${idPrefix}-meeting-topic`}
          value={formData.topic}
          onChange={(e) => onFormDataChange({ topic: e.target.value })}
          placeholder="회의 주제를 입력하세요"
        />
      </div>

      <div className="grid gap-2">
        <Label>업무 구분 (선택사항)</Label>
        <CategorySelector
          categories={taskCategories}
          selectedIds={formData.categoryIds}
          onSelectionChange={(ids) => onFormDataChange({ categoryIds: ids })}
          isLoading={categoriesLoading}
          idPrefix={`${idPrefix}-category`}
        />
      </div>

      <div className="grid gap-2">
        <Label>업무 그룹 (선택사항)</Label>
        <GroupSelector
          groups={groups}
          selectedIds={formData.groupIds}
          onSelectionChange={(ids) => onFormDataChange({ groupIds: ids })}
          isLoading={groupsLoading}
          idPrefix={`${idPrefix}-group`}
        />
      </div>

      <div className="grid gap-2">
        <Label>참석자</Label>
        <AssigneeSelector
          persons={persons}
          selectedPersonIds={formData.personIds}
          onSelectionChange={(ids) => onFormDataChange({ personIds: ids })}
          isLoading={personsLoading}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" onClick={handleNext}>
          다음
        </Button>
      </div>
    </div>
  );
}

export type { MeetingMinuteFormData };
