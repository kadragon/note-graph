// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027, TASK-045, TASK-LLM-IMPORT

import { StateRenderer } from '@web/components/state-renderer';
import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import { useDialogState } from '@web/hooks/use-dialog-state';
import { usePersons } from '@web/hooks/use-persons';
import { formatPhoneExt, truncateRoleDescription } from '@web/lib/utils';
import type { Person } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FileText, Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PersonDialog } from './components/person-dialog';
import { PersonImportDialog } from './components/person-import-dialog';

export default function Persons() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createDialog = useDialogState();
  const editDialog = useDialogState<Person>();
  const importDialog = useDialogState();
  const { data: persons = [], isLoading } = usePersons();

  // Get department filter from URL params
  const deptFilter = searchParams.get('dept');

  const clearDeptFilter = () => {
    setSearchParams({});
  };

  // Filter and sort persons, grouped by department
  const groupedPersons = useMemo(() => {
    const compareNullable = (a?: string | null, b?: string | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1; // nulls last
      if (b == null) return -1;
      return a.localeCompare(b, 'ko');
    };

    // Apply department filter
    const filtered = deptFilter ? persons.filter((p) => p.currentDept === deptFilter) : persons;

    // Sort all persons
    const sorted = [...filtered].sort((a, b) => {
      return (
        compareNullable(a.currentDept, b.currentDept) ||
        a.name.localeCompare(b.name, 'ko') ||
        compareNullable(a.currentPosition, b.currentPosition) ||
        a.personId.localeCompare(b.personId, 'ko') ||
        compareNullable(a.phoneExt, b.phoneExt) ||
        a.createdAt.localeCompare(b.createdAt)
      );
    });

    // Group by department
    const groups = new Map<string | null, Person[]>();
    sorted.forEach((person) => {
      const dept = person.currentDept || null;
      if (!groups.has(dept)) {
        groups.set(dept, []);
      }
      groups.get(dept)?.push(person);
    });

    return Array.from(groups.entries()).map(([dept, members]) => ({
      dept: dept || '부서 미지정',
      isDeptEmpty: !dept,
      members,
    }));
  }, [persons, deptFilter]);

  const handleRowClick = (person: Person) => {
    editDialog.open(person);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">사람 관리</h1>
          <p className="page-description">사람을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={importDialog.open}>
            <FileText className="h-4 w-4 mr-2" />
            가져오기
          </Button>
          <Button onClick={createDialog.open}>
            <Plus className="h-4 w-4 mr-2" />새 사람
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>사람 목록</CardTitle>
            {deptFilter && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">부서 필터:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {deptFilter}
                  <button
                    type="button"
                    onClick={clearDeptFilter}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                    aria-label="필터 해제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <StateRenderer
            isLoading={isLoading}
            isEmpty={persons.length === 0}
            emptyMessage="등록된 사람이 없습니다."
          >
            <div className="space-y-6">
              {groupedPersons.map((group) => (
                <div key={group.dept} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <button
                      type="button"
                      className="font-semibold text-sm hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
                      disabled={group.isDeptEmpty || !!deptFilter}
                      onClick={() => {
                        if (!group.isDeptEmpty && !deptFilter) {
                          setSearchParams({ dept: group.dept });
                        }
                      }}
                    >
                      {group.dept}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      ({group.members.length}명)
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-24">이름</TableHead>
                        <TableHead className="w-20">직책</TableHead>
                        <TableHead className="w-20">사번</TableHead>
                        <TableHead className="w-24">연락처</TableHead>
                        <TableHead>담당업무</TableHead>
                        <TableHead className="w-24">생성일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.members.map((person) => (
                        <TableRow
                          key={person.personId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(person)}
                        >
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell>
                            {person.currentPosition ? (
                              <span className="text-sm">{person.currentPosition}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{person.personId}</Badge>
                          </TableCell>
                          <TableCell>
                            {person.phoneExt ? (
                              <span className="text-sm font-mono">
                                {formatPhoneExt(person.phoneExt)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {person.currentRoleDesc ? (
                              <span className="text-sm" title={person.currentRoleDesc}>
                                {truncateRoleDescription(person.currentRoleDesc)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {format(parseISO(person.createdAt), 'yyyy-MM-dd', {
                              locale: ko,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </StateRenderer>
        </CardContent>
      </Card>

      <PersonDialog
        open={createDialog.isOpen}
        onOpenChange={createDialog.onOpenChange}
        mode="create"
      />

      <PersonDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        mode="edit"
        initialData={editDialog.id}
      />

      <PersonImportDialog open={importDialog.isOpen} onOpenChange={importDialog.onOpenChange} />
    </div>
  );
}
