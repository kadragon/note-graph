// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, ChevronsUpDown, History, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateDepartment, useDepartments } from '@/hooks/useDepartments';
import { useCreatePerson, usePersonHistory, useUpdatePerson } from '@/hooks/usePersons';
import { toCreateDepartmentRequest } from '@/lib/mappers/department';
import { cn } from '@/lib/utils';
import type { Person } from '@/types/api';

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialData?: Person | null;
}

interface ValidationErrors {
  name?: string;
  personId?: string;
  phoneExt?: string;
  currentDept?: string;
  currentPosition?: string;
}

export function PersonDialog({ open, onOpenChange, mode, initialData }: PersonDialogProps) {
  const [name, setName] = useState('');
  const [personId, setPersonId] = useState('');
  const [phoneExt, setPhoneExt] = useState('');
  const [currentDept, setCurrentDept] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const isEditMode = mode === 'edit';

  const createPersonMutation = useCreatePerson();
  const updatePersonMutation = useUpdatePerson();
  const { data: departments = [] } = useDepartments();
  const createDeptMutation = useCreateDepartment();
  const { data: history = [], isLoading: historyLoading } = usePersonHistory(
    isEditMode && initialData ? initialData.personId : null
  );

  const mutation = isEditMode ? updatePersonMutation : createPersonMutation;

  const selectedDept = departments.find((d) => d.deptName === currentDept);

  // Reset errors when dialog opens or closes
  useEffect(() => {
    if (open) {
      setErrors({});
    }
  }, [open]);

  // Pre-fill form fields in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name);
      setPersonId(initialData.personId);
      setPhoneExt(initialData.phoneExt || '');
      setCurrentDept(initialData.currentDept || '');
      setCurrentPosition(initialData.currentPosition || '');
      setErrors({});
    } else if (!isEditMode && open) {
      // Reset form in create mode when dialog opens
      setName('');
      setPersonId('');
      setPhoneExt('');
      setCurrentDept('');
      setCurrentPosition('');
      setHistoryOpen(false);
      setErrors({});
    }
  }, [isEditMode, initialData, open]);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = '이름을 입력하세요';
    } else if (name.trim().length > 100) {
      newErrors.name = '이름은 100자 이하여야 합니다';
    }

    // Validate personId (only in create mode)
    if (!isEditMode) {
      if (!personId.trim()) {
        newErrors.personId = '사번을 입력하세요';
      } else if (!/^\d{6}$/.test(personId.trim())) {
        newErrors.personId = '사번은 6자리 숫자여야 합니다';
      }
    }

    // Validate phoneExt (optional, but if provided must be 4 digits)
    if (phoneExt.trim() && !/^\d{4}$/.test(phoneExt.trim())) {
      newErrors.phoneExt = '연락처는 4자리 숫자여야 합니다';
    }

    // Validate currentDept (optional, but if provided must be within limits)
    if (currentDept && currentDept.length > 100) {
      newErrors.currentDept = '부서명은 100자 이하여야 합니다';
    }

    // Validate currentPosition (optional, but if provided must be within limits)
    if (currentPosition.trim().length > 100) {
      newErrors.currentPosition = '직책은 100자 이하여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      if (isEditMode && initialData) {
        // Edit mode: call updatePerson
        await updatePersonMutation.mutateAsync({
          personId: initialData.personId,
          data: {
            name: name.trim(),
            phoneExt: phoneExt.trim() || undefined,
            currentDept: currentDept || undefined,
            currentPosition: currentPosition.trim() || undefined,
          },
        });
      } else {
        // Create mode: call createPerson
        await createPersonMutation.mutateAsync({
          name: name.trim(),
          personId: personId.trim(),
          phoneExt: phoneExt.trim() || undefined,
          currentDept: currentDept || undefined,
          currentPosition: currentPosition.trim() || undefined,
        });
      }

      // Reset form, errors and close dialog on success
      setName('');
      setPersonId('');
      setPhoneExt('');
      setCurrentDept('');
      setCurrentPosition('');
      setHistoryOpen(false);
      setErrors({});
      onOpenChange(false);
    } catch {
      // Error handled by mutation hook (toast notification)
    }
  };

  const handleCreateDept = async () => {
    if (!newDeptName.trim()) return;

    try {
      const dept = await createDeptMutation.mutateAsync(toCreateDepartmentRequest(newDeptName));
      setCurrentDept(dept.deptName);
      setNewDeptName('');
      setDeptOpen(false);
    } catch {
      // Error handled by mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? '사람 정보 수정' : '새 사람 추가'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? '사람 정보를 수정합니다.' : '새로운 사람을 추가합니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Clear error when user starts typing
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="이름을 입력하세요"
                className={cn(errors.name && 'border-destructive')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personId">사번</Label>
              <Input
                id="personId"
                value={personId}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  // Clear error when user starts typing
                  if (errors.personId) {
                    setErrors((prev) => ({ ...prev, personId: undefined }));
                  }
                }}
                placeholder="6자리 사번"
                maxLength={6}
                disabled={isEditMode}
                className={cn(
                  isEditMode && 'bg-muted cursor-not-allowed',
                  errors.personId && 'border-destructive'
                )}
              />
              {errors.personId && <p className="text-sm text-destructive">{errors.personId}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phoneExt">연락처 (선택)</Label>
              <Input
                id="phoneExt"
                value={phoneExt}
                onChange={(e) => {
                  setPhoneExt(e.target.value);
                  if (errors.phoneExt) {
                    setErrors((prev) => ({ ...prev, phoneExt: undefined }));
                  }
                }}
                placeholder="4자리 내선번호 (예: 3346)"
                maxLength={4}
                className={cn(errors.phoneExt && 'border-destructive')}
              />
              {errors.phoneExt && <p className="text-sm text-destructive">{errors.phoneExt}</p>}
            </div>

            <div className="grid gap-2">
              <Label>부서 (선택)</Label>
              <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={deptOpen}
                    className={cn('justify-between', errors.currentDept && 'border-destructive')}
                    type="button"
                  >
                    {selectedDept ? selectedDept.deptName : '부서를 선택하세요'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="부서 검색..." />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2">
                          <p className="text-sm text-muted-foreground mb-2">부서가 없습니다.</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="새 부서명"
                              value={newDeptName}
                              onChange={(e) => setNewDeptName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleCreateDept();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleCreateDept()}
                              disabled={createDeptMutation.isPending}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {departments.map((dept) => (
                          <CommandItem
                            key={dept.deptName}
                            value={dept.deptName}
                            onSelect={() => {
                              setCurrentDept(dept.deptName);
                              setDeptOpen(false);
                              // Clear error when user selects a dept
                              if (errors.currentDept) {
                                setErrors((prev) => ({
                                  ...prev,
                                  currentDept: undefined,
                                }));
                              }
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                currentDept === dept.deptName ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {dept.deptName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.currentDept && (
                <p className="text-sm text-destructive">{errors.currentDept}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currentPosition">직책 (선택)</Label>
              <Input
                id="currentPosition"
                value={currentPosition}
                onChange={(e) => {
                  setCurrentPosition(e.target.value);
                  // Clear error when user starts typing
                  if (errors.currentPosition) {
                    setErrors((prev) => ({
                      ...prev,
                      currentPosition: undefined,
                    }));
                  }
                }}
                placeholder="예: 팀장, 대리, 과장"
                className={cn(errors.currentPosition && 'border-destructive')}
              />
              {errors.currentPosition && (
                <p className="text-sm text-destructive">{errors.currentPosition}</p>
              )}
            </div>

            {/* Department History Section - only in edit mode */}
            {isEditMode && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-between px-0 hover:bg-transparent"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <History className="h-4 w-4" />
                      부서 이력 ({history.length}건)
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      부서 이력이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            'p-3 rounded-lg border text-sm',
                            entry.isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{entry.deptName}</span>
                            {entry.isActive && (
                              <Badge variant="default" className="text-xs">
                                현재
                              </Badge>
                            )}
                          </div>
                          {entry.position && (
                            <p className="text-muted-foreground">직책: {entry.position}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(parseISO(entry.startDate), 'yyyy-MM-dd', {
                              locale: ko,
                            })}
                            {' ~ '}
                            {entry.endDate
                              ? format(parseISO(entry.endDate), 'yyyy-MM-dd', {
                                  locale: ko,
                                })
                              : '현재'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErrors({});
                onOpenChange(false);
              }}
              disabled={mutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? isEditMode
                  ? '수정 중...'
                  : '저장 중...'
                : isEditMode
                  ? '수정'
                  : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
