import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Person, Department, WorkNote } from '@/types/api';

// PersonFilterSelector - 단일 사람 선택
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
  const [open, setOpen] = useState(false);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.personId === selectedPersonId),
    [persons, selectedPersonId]
  );

  const handleSelect = (personId: string) => {
    if (selectedPersonId === personId) {
      onSelectionChange(null);
    } else {
      onSelectionChange(personId);
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSelectionChange(null);
  };

  return (
    <div className="grid gap-2">
      {selectedPerson && (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="gap-1 pr-1">
            <span>{selectedPerson.name} ({selectedPerson.personId})</span>
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-secondary-foreground/20"
              onClick={handleClear}
              disabled={disabled}
              aria-label={`${selectedPerson.name} 제거`}
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
            {isLoading
              ? '로딩 중...'
              : selectedPerson
                ? `${selectedPerson.name} 선택됨`
                : '사람 검색...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="이름 또는 ID로 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {persons.map((person) => {
                  const isSelected = selectedPersonId === person.personId;
                  return (
                    <CommandItem
                      key={person.personId}
                      value={`${person.name} ${person.personId}`}
                      onSelect={() => handleSelect(person.personId)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{person.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {person.personId}
                          {person.currentDept && ` • ${person.currentDept}`}
                          {person.currentPosition && ` • ${person.currentPosition}`}
                        </span>
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

// DepartmentFilterSelector - 단일 부서 선택
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
  const [open, setOpen] = useState(false);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.deptName === selectedDeptName),
    [departments, selectedDeptName]
  );

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.isActive),
    [departments]
  );

  const handleSelect = (deptName: string) => {
    if (selectedDeptName === deptName) {
      onSelectionChange(null);
    } else {
      onSelectionChange(deptName);
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSelectionChange(null);
  };

  return (
    <div className="grid gap-2">
      {selectedDepartment && (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="gap-1 pr-1">
            <span>{selectedDepartment.deptName}</span>
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-secondary-foreground/20"
              onClick={handleClear}
              disabled={disabled}
              aria-label={`${selectedDepartment.deptName} 제거`}
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
            {isLoading
              ? '로딩 중...'
              : selectedDepartment
                ? `${selectedDepartment.deptName} 선택됨`
                : '부서 검색...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="부서명으로 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {activeDepartments.map((dept) => {
                  const isSelected = selectedDeptName === dept.deptName;
                  return (
                    <CommandItem
                      key={dept.deptName}
                      value={dept.deptName}
                      onSelect={() => handleSelect(dept.deptName)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{dept.deptName}</span>
                        {dept.description && (
                          <span className="text-xs text-muted-foreground">
                            {dept.description}
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

// WorkNoteFilterSelector - 단일 업무노트 선택
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
  const [open, setOpen] = useState(false);

  const selectedWorkNote = useMemo(
    () => workNotes.find((w) => w.id === selectedWorkId),
    [workNotes, selectedWorkId]
  );

  const handleSelect = (workId: string) => {
    if (selectedWorkId === workId) {
      onSelectionChange(null);
    } else {
      onSelectionChange(workId);
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSelectionChange(null);
  };

  return (
    <div className="grid gap-2">
      {selectedWorkNote && (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="gap-1 pr-1 max-w-full">
            <span className="truncate">{selectedWorkNote.title}</span>
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-secondary-foreground/20 flex-shrink-0"
              onClick={handleClear}
              disabled={disabled}
              aria-label={`${selectedWorkNote.title} 제거`}
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
            {isLoading
              ? '로딩 중...'
              : selectedWorkNote
                ? '업무노트 선택됨'
                : '업무노트 검색...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="제목 또는 ID로 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {workNotes.map((workNote) => {
                  const isSelected = selectedWorkId === workNote.id;
                  return (
                    <CommandItem
                      key={workNote.id}
                      value={`${workNote.title} ${workNote.id}`}
                      onSelect={() => handleSelect(workNote.id)}
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
                        <span className="font-medium truncate">{workNote.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {workNote.id}
                          {workNote.category && ` • ${workNote.category}`}
                        </span>
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
