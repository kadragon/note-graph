import { Checkbox } from '@web/components/ui/checkbox';
import type { TaskCategory } from '@web/types/api';
import type { RefObject } from 'react';

interface CategorySelectorProps {
  categories: TaskCategory[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
  idPrefix?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function CategorySelector({
  categories,
  selectedIds,
  onSelectionChange,
  isLoading = false,
  idPrefix = 'category',
  containerRef,
}: CategorySelectorProps) {
  const handleToggle = (categoryId: string) => {
    const newIds = selectedIds.includes(categoryId)
      ? selectedIds.filter((id) => id !== categoryId)
      : [...selectedIds, categoryId];
    onSelectionChange(newIds);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중...</p>;
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 업무 구분이 없습니다.</p>;
  }

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto border rounded-md p-3"
    >
      {categories.map((category) => {
        const isInactive = !category.isActive;
        const isSelected = selectedIds.includes(category.categoryId);
        return (
          <div
            key={category.categoryId}
            className={`flex items-center space-x-2 ${isInactive ? 'opacity-60' : ''}`}
          >
            <Checkbox
              id={`${idPrefix}-${category.categoryId}`}
              checked={isSelected}
              onCheckedChange={() => handleToggle(category.categoryId)}
              disabled={isInactive && !isSelected}
            />
            <label
              htmlFor={`${idPrefix}-${category.categoryId}`}
              className={`text-sm font-medium leading-none ${
                isInactive && !isSelected ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {category.name}
              {isInactive && <span className="ml-1 text-xs text-muted-foreground">(비활성)</span>}
            </label>
          </div>
        );
      })}
    </div>
  );
}
