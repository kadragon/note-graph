import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Department, Person, WorkNote } from '@/types/api';

// 제네릭 필터 선택 컴포넌트
interface FilterSelectorProps<T> {
  items: T[];
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemSecondaryLabel?: (item: T) => string;
  getSearchValue: (item: T) => string;
  placeholder: string;
  searchPlaceholder: string;
  selectedLabel: string;
}

function FilterSelector<T>({
  items,
  selectedId,
  onSelectionChange,
  isLoading = false,
  disabled = false,
  getItemId,
  getItemLabel,
  getItemSecondaryLabel,
  getSearchValue,
  placeholder,
  searchPlaceholder,
  selectedLabel,
}: FilterSelectorProps<T>) {
  const [open, setOpen] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => getItemId(item) === selectedId),
    [items, selectedId, getItemId]
  );

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      onSelectionChange(null);
    } else {
      onSelectionChange(id);
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSelectionChange(null);
  };

  return (
    <div className="grid gap-2">
      {selectedItem && (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="gap-1 pr-1 max-w-full">
            <span className="truncate">{getItemLabel(selectedItem)}</span>
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-secondary-foreground/20 flex-shrink-0"
              onClick={handleClear}
              disabled={disabled}
              aria-label={`${getItemLabel(selectedItem)} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between"
            disabled={disabled || isLoading}
            type="button"
          >
            {isLoading ? '로딩 중...' : selectedItem ? selectedLabel : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const id = getItemId(item);
                  const isSelected = selectedId === id;
                  return (
                    <CommandItem
                      key={id}
                      value={getSearchValue(item)}
                      onSelect={() => handleSelect(id)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary flex-shrink-0',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{getItemLabel(item)}</span>
                        {getItemSecondaryLabel && (
                          <span className="text-xs text-muted-foreground">
                            {getItemSecondaryLabel(item)}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// PersonFilterSelector - 사람 선택 래퍼
interface PersonFilterSelectorProps {
  persons: Person[];
  selectedPersonId: string | null;
  onSelectionChange: (personId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PersonFilterSelector({
  persons,
  selectedPersonId,
  onSelectionChange,
  isLoading = false,
  disabled = false,
}: PersonFilterSelectorProps) {
  return (
    <FilterSelector
      items={persons}
      selectedId={selectedPersonId}
      onSelectionChange={onSelectionChange}
      isLoading={isLoading}
      disabled={disabled}
      getItemId={(person) => person.personId}
      getItemLabel={(person) => `${person.name} (${person.personId})`}
      getItemSecondaryLabel={(person) => {
        const parts = [person.personId];
        if (person.currentDept) parts.push(person.currentDept);
        if (person.currentPosition) parts.push(person.currentPosition);
        return parts.join(' • ');
      }}
      getSearchValue={(person) => `${person.name} ${person.personId}`}
      placeholder="사람 검색..."
      searchPlaceholder="이름 또는 ID로 검색..."
      selectedLabel="사람 선택됨"
    />
  );
}

// DepartmentFilterSelector - 부서 선택 래퍼
interface DepartmentFilterSelectorProps {
  departments: Department[];
  selectedDeptName: string | null;
  onSelectionChange: (deptName: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function DepartmentFilterSelector({
  departments,
  selectedDeptName,
  onSelectionChange,
  isLoading = false,
  disabled = false,
}: DepartmentFilterSelectorProps) {
  const activeDepartments = useMemo(() => departments.filter((d) => d.isActive), [departments]);

  return (
    <FilterSelector
      items={activeDepartments}
      selectedId={selectedDeptName}
      onSelectionChange={onSelectionChange}
      isLoading={isLoading}
      disabled={disabled}
      getItemId={(dept) => dept.deptName}
      getItemLabel={(dept) => dept.deptName}
      getItemSecondaryLabel={(dept) => dept.description || ''}
      getSearchValue={(dept) => dept.deptName}
      placeholder="부서 검색..."
      searchPlaceholder="부서명으로 검색..."
      selectedLabel="부서 선택됨"
    />
  );
}

// WorkNoteFilterSelector - 업무노트 선택 래퍼
interface WorkNoteFilterSelectorProps {
  workNotes: WorkNote[];
  selectedWorkId: string | null;
  onSelectionChange: (workId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function WorkNoteFilterSelector({
  workNotes,
  selectedWorkId,
  onSelectionChange,
  isLoading = false,
  disabled = false,
}: WorkNoteFilterSelectorProps) {
  return (
    <FilterSelector
      items={workNotes}
      selectedId={selectedWorkId}
      onSelectionChange={onSelectionChange}
      isLoading={isLoading}
      disabled={disabled}
      getItemId={(workNote) => workNote.id}
      getItemLabel={(workNote) => workNote.title}
      getItemSecondaryLabel={(workNote) => {
        const parts = [workNote.id];
        if (workNote.category) parts.push(workNote.category);
        return parts.join(' • ');
      }}
      getSearchValue={(workNote) => `${workNote.title} ${workNote.id}`}
      placeholder="업무노트 검색..."
      searchPlaceholder="제목 또는 ID로 검색..."
      selectedLabel="업무노트 선택됨"
    />
  );
}
