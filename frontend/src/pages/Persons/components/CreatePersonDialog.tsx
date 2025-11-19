// Trace: SPEC-person-1, TASK-022
import { useState } from 'react';
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
import { useCreatePerson } from '@/hooks/usePersons';
import { useDepartments, useCreateDepartment } from '@/hooks/useDepartments';
import { toCreateDepartmentRequest } from '@/lib/mappers/department';

interface CreatePersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePersonDialog({
  open,
  onOpenChange,
}: CreatePersonDialogProps) {
  const [name, setName] = useState('');
  const [personId, setPersonId] = useState('');
  const [currentDept, setCurrentDept] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  const createPersonMutation = useCreatePerson();
  const { data: departments = [] } = useDepartments();
  const createDeptMutation = useCreateDepartment();

  const selectedDept = departments.find((d) => d.deptName === currentDept);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !personId.trim()) return;

    try {
      await createPersonMutation.mutateAsync({
        name: name.trim(),
        personId: personId.trim(),
        currentDept: currentDept || undefined,
        currentPosition: currentPosition.trim() || undefined,
      });
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
            <DialogTitle>새 사람 추가</DialogTitle>
            <DialogDescription>
              새로운 사람을 추가합니다.
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
                required
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
              disabled={createPersonMutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={createPersonMutation.isPending}>
              {createPersonMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
