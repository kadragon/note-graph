// Trace: SPEC-project-1, TASK-043
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProject } from '@/hooks/useProjects';
import { usePersons } from '@/hooks/usePersons';
import { useDepartments } from '@/hooks/useDepartments';
import type { ProjectStatus, ProjectPriority } from '@/types/api';
import { Checkbox } from '@/components/ui/checkbox';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('진행중');
  const [priority, setPriority] = useState<ProjectPriority>('중간');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [leaderPersonId, setLeaderPersonId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [tags, setTags] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');

  const createMutation = useCreateProject();
  const { data: persons = [] } = usePersons();
  const { data: departments = [] } = useDepartments();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        startDate: startDate || undefined,
        targetEndDate: targetEndDate || undefined,
        leaderPersonId: leaderPersonId || undefined,
        deptName: deptName || undefined,
        tags: tags.trim() || undefined,
        participantIds,
      });

      // Reset form and close dialog
      setName('');
      setDescription('');
      setStatus('진행중');
      setPriority('중간');
      setStartDate('');
      setTargetEndDate('');
      setLeaderPersonId('');
      setDeptName('');
      setTags('');
      setParticipantIds([]);
      setParticipantSearch('');
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>새 프로젝트 생성</DialogTitle>
            <DialogDescription>
              새로운 프로젝트를 생성합니다. 필수 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">프로젝트명 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="프로젝트 이름을 입력하세요"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트 설명을 입력하세요"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">상태</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="진행중">진행중</SelectItem>
                    <SelectItem value="완료">완료</SelectItem>
                    <SelectItem value="보류">보류</SelectItem>
                    <SelectItem value="중단">중단</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">우선순위</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as ProjectPriority)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="높음">높음</SelectItem>
                    <SelectItem value="중간">중간</SelectItem>
                    <SelectItem value="낮음">낮음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">시작일</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="targetEndDate">목표 종료일</Label>
                <Input
                  id="targetEndDate"
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="leaderPersonId">프로젝트 리더</Label>
              <Select value={leaderPersonId || undefined} onValueChange={setLeaderPersonId}>
                <SelectTrigger id="leaderPersonId">
                  <SelectValue placeholder="리더를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((person) => (
                    <SelectItem key={person.personId} value={person.personId}>
                      {person.name} ({person.personId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deptName">담당 부서</Label>
              <Select value={deptName || undefined} onValueChange={setDeptName}>
                <SelectTrigger id="deptName">
                  <SelectValue placeholder="부서를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.deptName} value={dept.deptName}>
                      {dept.deptName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="예: 개발, 디자인, 마케팅"
              />
            </div>

            <div className="grid gap-2">
              <Label>참여자</Label>
              <Input
                placeholder="참여자 검색..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="mb-2"
              />
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-md p-3">
                {persons
                  .filter((person) => {
                    if (!participantSearch) return true;
                    const search = participantSearch.toLowerCase();
                    return (
                      person.name.toLowerCase().includes(search) ||
                      person.personId.toLowerCase().includes(search)
                    );
                  })
                  .map((person) => {
                    const checked = participantIds.includes(person.personId);
                    return (
                      <label
                        key={person.personId}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            if (value) {
                              setParticipantIds((prev) => [...prev, person.personId]);
                            } else {
                              setParticipantIds((prev) => prev.filter((id) => id !== person.personId));
                            }
                          }}
                        />
                        <span>{person.name} ({person.personId})</span>
                      </label>
                    );
                  })}
                {persons.filter((person) => {
                  if (!participantSearch) return true;
                  const search = participantSearch.toLowerCase();
                  return (
                    person.name.toLowerCase().includes(search) ||
                    person.personId.toLowerCase().includes(search)
                  );
                }).length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    {persons.length === 0 ? '등록된 사람이 없습니다.' : '검색 결과가 없습니다.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
