// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-021, TASK-022, TASK-025, TASK-027

import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@web/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@web/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@web/components/ui/popover';
import { useDebouncedValue } from '@web/hooks/use-debounced-value';
import { useCreateDepartment, useDepartments } from '@web/hooks/use-departments';
import { useCreatePerson, usePersonHistory, useUpdatePerson } from '@web/hooks/use-persons';
import { toCreateDepartmentRequest } from '@web/lib/mappers/department';
import { cn } from '@web/lib/utils';
import type { Person } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, ChevronsUpDown, History, Loader2, Plus } from 'lucide-react';
import { useEffect, useReducer, useState } from 'react';

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

interface FormState {
  name: string;
  personId: string;
  phoneExt: string;
  currentDept: string;
  currentPosition: string;
  errors: ValidationErrors;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof Omit<FormState, 'errors'>; value: string }
  | { type: 'SET_ERRORS'; errors: ValidationErrors }
  | { type: 'CLEAR_FIELD_ERROR'; field: keyof ValidationErrors }
  | { type: 'RESET' }
  | { type: 'LOAD_INITIAL'; data: Person };

const initialFormState: FormState = {
  name: '',
  personId: '',
  phoneExt: '',
  currentDept: '',
  currentPosition: '',
  errors: {},
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'CLEAR_FIELD_ERROR':
      return { ...state, errors: { ...state.errors, [action.field]: undefined } };
    case 'RESET':
      return initialFormState;
    case 'LOAD_INITIAL':
      return {
        name: action.data.name,
        personId: action.data.personId,
        phoneExt: action.data.phoneExt || '',
        currentDept: action.data.currentDept || '',
        currentPosition: action.data.currentPosition || '',
        errors: {},
      };
    default:
      return state;
  }
}

export function PersonDialog({ open, onOpenChange, mode, initialData }: PersonDialogProps) {
  const [form, dispatch] = useReducer(formReducer, initialFormState);
  const { name, personId, phoneExt, currentDept, currentPosition, errors } = form;

  // UI state (independent of form data)
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const isEditMode = mode === 'edit';

  const createPersonMutation = useCreatePerson();
  const updatePersonMutation = useUpdatePerson();
  const debouncedDeptSearch = useDebouncedValue(deptSearch);
  const {
    data: departments = [],
    isFetching: isFetchingDepartments,
    isError: isDepartmentsError,
    refetch: refetchDepartments,
  } = useDepartments({ search: debouncedDeptSearch });
  const createDeptMutation = useCreateDepartment();
  const { data: history = [], isLoading: historyLoading } = usePersonHistory(
    isEditMode && initialData ? initialData.personId : null
  );

  const mutation = isEditMode ? updatePersonMutation : createPersonMutation;

  const selectedDept = departments.find((d) => d.deptName === currentDept);

  // Reset errors when dialog opens or closes
  useEffect(() => {
    if (open) {
      dispatch({ type: 'SET_ERRORS', errors: {} });
    }
  }, [open]);

  // Pre-fill form fields in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      dispatch({ type: 'LOAD_INITIAL', data: initialData });
      setDeptSearch('');
    } else if (!isEditMode && open) {
      // Reset form in create mode when dialog opens
      dispatch({ type: 'RESET' });
      setDeptSearch('');
      setHistoryOpen(false);
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

    // Validate phoneExt (optional, but if provided must match backend schema)
    // Backend: max 15 chars, digits and hyphens only (src/schemas/person.ts:19-23)
    if (phoneExt.trim()) {
      if (phoneExt.trim().length > 15) {
        newErrors.phoneExt = '연락처는 15자 이하여야 합니다';
      } else if (!/^[\d-]+$/.test(phoneExt.trim())) {
        newErrors.phoneExt = '연락처는 숫자와 하이픈(-)만 입력 가능합니다';
      }
    }

    // Validate currentDept (optional, but if provided must be within limits)
    if (currentDept && currentDept.length > 100) {
      newErrors.currentDept = '부서명은 100자 이하여야 합니다';
    }

    // Validate currentPosition (optional, but if provided must be within limits)
    if (currentPosition.trim().length > 100) {
      newErrors.currentPosition = '직책은 100자 이하여야 합니다';
    }

    dispatch({ type: 'SET_ERRORS', errors: newErrors });
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
      dispatch({ type: 'RESET' });
      setHistoryOpen(false);
      onOpenChange(false);
    } catch {
      // Error handled by mutation hook (toast notification)
    }
  };

  const handleCreateDept = async () => {
    if (!newDeptName.trim()) return;

    try {
      const dept = await createDeptMutation.mutateAsync(toCreateDepartmentRequest(newDeptName));
      dispatch({ type: 'SET_FIELD', field: 'currentDept', value: dept.deptName });
      setNewDeptName('');
      setDeptOpen(false);
      setDeptSearch('');
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
                  dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value });
                  if (errors.name) {
                    dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'name' });
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
                  dispatch({ type: 'SET_FIELD', field: 'personId', value: e.target.value });
                  if (errors.personId) {
                    dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'personId' });
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
                  dispatch({ type: 'SET_FIELD', field: 'phoneExt', value: e.target.value });
                  if (errors.phoneExt) {
                    dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'phoneExt' });
                  }
                }}
                placeholder="연락처 (예: 3346, 043-230-3346)"
                maxLength={15}
                className={cn(errors.phoneExt && 'border-destructive')}
              />
              {errors.phoneExt && <p className="text-sm text-destructive">{errors.phoneExt}</p>}
            </div>

            <div className="grid gap-2">
              <Label>부서 (선택)</Label>
              <Popover
                open={deptOpen}
                onOpenChange={(openState) => {
                  setDeptOpen(openState);
                  if (!openState) setDeptSearch('');
                }}
              >
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
                    <CommandInput
                      placeholder="부서 검색..."
                      value={deptSearch}
                      onValueChange={setDeptSearch}
                      autoFocus
                      aria-label="부서 검색"
                    />
                    {isFetchingDepartments && (
                      <div
                        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
                        aria-busy="true"
                        aria-live="polite"
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        검색 중...
                      </div>
                    )}
                    <CommandList>
                      <CommandEmpty>
                        {isDepartmentsError ? (
                          <div role="alert" className="p-2 space-y-2">
                            <p className="text-sm text-destructive">부서를 불러오지 못했습니다.</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void refetchDepartments()}
                              className="w-full"
                            >
                              다시 시도
                            </Button>
                          </div>
                        ) : (
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
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {departments.map((dept) => (
                          <CommandItem
                            key={dept.deptName}
                            value={dept.deptName}
                            onSelect={() => {
                              dispatch({
                                type: 'SET_FIELD',
                                field: 'currentDept',
                                value: dept.deptName,
                              });
                              setDeptOpen(false);
                              setDeptSearch('');
                              if (errors.currentDept) {
                                dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'currentDept' });
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
                  dispatch({ type: 'SET_FIELD', field: 'currentPosition', value: e.target.value });
                  if (errors.currentPosition) {
                    dispatch({ type: 'CLEAR_FIELD_ERROR', field: 'currentPosition' });
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
                dispatch({ type: 'SET_ERRORS', errors: {} });
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
