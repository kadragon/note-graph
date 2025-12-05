// Trace: TASK-024, TASK-025, SPEC-worknote-1, SPEC-worknote-2

import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@web/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@web/components/ui/popover';
import { cn, formatPersonBadge } from '@web/lib/utils';
import type { Person } from '@web/types/api';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

interface AssigneeSelectorProps {
  persons: Person[];
  selectedPersonIds: string[];
  onSelectionChange: (personIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AssigneeSelector({
  persons,
  selectedPersonIds,
  onSelectionChange,
  isLoading = false,
  disabled = false,
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);

  // Memoize selected persons to avoid recalculating on every render
  const selectedPersons = useMemo(
    () => persons.filter((p) => selectedPersonIds.includes(p.personId)),
    [persons, selectedPersonIds]
  );

  // Stabilize callback references for performance
  const togglePerson = useCallback(
    (personId: string) => {
      const newSelection = selectedPersonIds.includes(personId)
        ? selectedPersonIds.filter((id) => id !== personId)
        : [...selectedPersonIds, personId];
      onSelectionChange(newSelection);
    },
    [selectedPersonIds, onSelectionChange]
  );

  const removePerson = useCallback(
    (personId: string) => {
      onSelectionChange(selectedPersonIds.filter((id) => id !== personId));
    },
    [selectedPersonIds, onSelectionChange]
  );

  return (
    <div className="grid gap-2">
      {/* Selected badges */}
      {selectedPersons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedPersons.map((person) => (
            <Badge key={person.personId} variant="secondary" className="gap-1 pr-1">
              <span>{formatPersonBadge(person)}</span>
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                onClick={(e) => {
                  e.preventDefault();
                  removePerson(person.personId);
                }}
                disabled={disabled}
                aria-label={`${person.name} 제거`}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">{person.name} 제거</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Popover trigger */}
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
              : selectedPersons.length > 0
                ? `${selectedPersons.length}명 선택됨`
                : '담당자 검색...'}
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
                  const isSelected = selectedPersonIds.includes(person.personId);
                  return (
                    <CommandItem
                      key={person.personId}
                      value={`${person.name} ${person.personId}`}
                      onSelect={() => togglePerson(person.personId)}
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
