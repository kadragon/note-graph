// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027, TASK-045, TASK-LLM-IMPORT

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
import { usePersons } from '@web/hooks/use-persons';
import { getDepartmentColor } from '@web/lib/utils';
import type { Person } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FileText, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PersonDialog } from './components/person-dialog';
import { PersonImportDialog } from './components/person-import-dialog';

export default function Persons() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const { data: persons = [], isLoading } = usePersons();

  // Get department filter from URL params
  const deptFilter = searchParams.get('dept');

  const handleDeptClick = (deptName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setSearchParams({ dept: deptName });
  };

  const clearDeptFilter = () => {
    setSearchParams({});
  };

  // Filter and sort persons
  const sortedPersons = useMemo(() => {
    const compareNullable = (a?: string | null, b?: string | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1; // nulls last
      if (b == null) return -1;
      return a.localeCompare(b, 'ko');
    };

    // Apply department filter
    const filtered = deptFilter ? persons.filter((p) => p.currentDept === deptFilter) : persons;

    return [...filtered].sort((a, b) => {
      return (
        compareNullable(a.currentDept, b.currentDept) ||
        a.name.localeCompare(b.name, 'ko') ||
        compareNullable(a.currentPosition, b.currentPosition) ||
        a.personId.localeCompare(b.personId, 'ko') ||
        compareNullable(a.phoneExt, b.phoneExt) ||
        a.createdAt.localeCompare(b.createdAt)
      );
    });
  }, [persons, deptFilter]);

  const handleRowClick = (person: Person) => {
    setSelectedPerson(person);
    setEditDialogOpen(true);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">사람 관리</h1>
          <p className="page-description">사람을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            가져오기
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : persons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">등록된 사람이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>사번</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPersons.map((person) => (
                  <TableRow
                    key={person.personId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(person)}
                  >
                    <TableCell>
                      {person.currentDept ? (
                        <Badge
                          className={`${getDepartmentColor(person.currentDept)} cursor-pointer hover:opacity-80 transition-opacity`}
                          onClick={(e) => {
                            if (person.currentDept) handleDeptClick(person.currentDept, e);
                          }}
                        >
                          {person.currentDept}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
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
                        <span className="text-sm font-mono">{person.phoneExt}</span>
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
          )}
        </CardContent>
      </Card>

      <PersonDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" />

      <PersonDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        initialData={selectedPerson}
      />

      <PersonImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
