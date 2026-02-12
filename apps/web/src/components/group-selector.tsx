import { Checkbox } from '@web/components/ui/checkbox';
import type { WorkNoteGroup } from '@web/types/api';

interface GroupSelectorProps {
  groups: WorkNoteGroup[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
  idPrefix?: string;
}

export function GroupSelector({
  groups,
  selectedIds,
  onSelectionChange,
  isLoading = false,
  idPrefix = 'group',
}: GroupSelectorProps) {
  const handleToggle = (groupId: string) => {
    const newIds = selectedIds.includes(groupId)
      ? selectedIds.filter((id) => id !== groupId)
      : [...selectedIds, groupId];
    onSelectionChange(newIds);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중...</p>;
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 업무 그룹이 없습니다.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto border rounded-md p-3">
      {groups.map((group) => {
        const isInactive = !group.isActive;
        const isSelected = selectedIds.includes(group.groupId);
        return (
          <div
            key={group.groupId}
            className={`flex items-center space-x-2 ${isInactive ? 'opacity-60' : ''}`}
          >
            <Checkbox
              id={`${idPrefix}-${group.groupId}`}
              checked={isSelected}
              onCheckedChange={() => handleToggle(group.groupId)}
              disabled={isInactive && !isSelected}
            />
            <label
              htmlFor={`${idPrefix}-${group.groupId}`}
              className={`text-sm font-medium leading-none ${
                isInactive && !isSelected ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {group.name}
              {isInactive && <span className="ml-1 text-xs text-muted-foreground">(비활성)</span>}
            </label>
          </div>
        );
      })}
    </div>
  );
}
