// Trace: SPEC-person-1, SPEC-person-2, TASK-022, TASK-025
import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useCreatePerson, useUpdatePerson } from '@/hooks/usePersons';
import { useDepartments, useCreateDepartment } from '@/hooks/useDepartments';
import { toCreateDepartmentRequest } from '@/lib/mappers/department';
import type { Person } from '@/types/api';

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialData?: Person | null;
}

export function PersonDialog({
  open,
  onOpenChange,
  mode,
  initialData,
}: PersonDialogProps) {
  const [name, setName] = useState('');
  const [personId, setPersonId] = useState('');
  const [currentDept, setCurrentDept] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  const createPersonMutation = useCreatePerson();
  const updatePersonMutation = useUpdatePerson();
  const { data: departments = [] } = useDepartments();
  const createDeptMutation = useCreateDepartment();

  const isEditMode = mode === 'edit';
  const mutation = isEditMode ? updatePersonMutation : createPersonMutation;

  const selectedDept = departments.find((d) => d.deptName === currentDept);

  // Pre-fill form fields in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name);
      setPersonId(initialData.personId);
      setCurrentDept(initialData.currentDept || '');
      setCurrentPosition(initialData.currentPosition || '');
    } else if (!isEditMode) {
      // Reset form in create mode
      setName('');
      setPersonId('');
      setCurrentDept('');
      setCurrentPosition('');
    }
  }, [isEditMode, initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || (!isEditMode && !personId.trim())) return;

    try {
      if (isEditMode && initialData) {
        // Edit mode: call updatePerson
        await updatePersonMutation.mutateAsync({
          personId: initialData.personId,
          data: {
            name: name.trim(),
            currentDept: currentDept || undefined,
            currentPosition: currentPosition.trim() || undefined,
          },
        });
      } else {
        // Create mode: call createPerson
        await createPersonMutation.mutateAsync({
          name: name.trim(),
          personId: personId.trim(),
          currentDept: currentDept || undefined,
          currentPosition: currentPosition.trim() || undefined,
        });
      }

      // Reset form and close dialog
      setName('');
      setPersonId('');
      setCurrentDept('');
      setCurrentPosition('');
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCreateDept = async () => {
    if (!newDeptName.trim()) return;

    try {
      const dept = await createDeptMutation.mutateAsync(
        toCreateDepartmentRequest(newDeptName)
      );
      setCurrentDept(dept.deptName);
      setNewDeptName('');
      setDeptOpen(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? '사람 정보 수정' : '새 사람 추가'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? '사람 정보를 수정합니다.'
                : '새로운 사람을 추가합니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personId">사번</Label>
              <Input
                id="personId"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                placeholder="6자리 사번"
                maxLength={6}
                required={!isEditMode}
                disabled={isEditMode}
                className={cn(isEditMode && 'bg-muted cursor-not-allowed')}
              />
            </div>

            <div className="grid gap-2">
              <Label>부서 (선택)</Label>
              <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={deptOpen}
                    className="justify-between"
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
                          <p className="text-sm text-muted-foreground mb-2">
                            부서가 없습니다.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="새 부서명"
                              value={newDeptName}
                              onChange={(e) => setNewDeptName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateDept();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleCreateDept}
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
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                currentDept === dept.deptName
                                  ? 'opacity-100'
                                  : 'opacity-0'
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currentPosition">직책 (선택)</Label>
              <Input
                id="currentPosition"
                value={currentPosition}
                onChange={(e) => setCurrentPosition(e.target.value)}
                placeholder="예: 팀장, 대리, 과장"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
