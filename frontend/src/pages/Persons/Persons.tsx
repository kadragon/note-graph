// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027, TASK-LLM-IMPORT
import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePersons } from '@/hooks/usePersons';
import { PersonDialog } from './components/PersonDialog';
import { PersonImportDialog } from './components/PersonImportDialog';
import type { Person } from '@/types/api';

export default function Persons() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const { data: persons = [], isLoading } = usePersons();

  const handleRowClick = (person: Person) => {
    setSelectedPerson(person);
    setEditDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사람 관리</h1>
          <p className="text-gray-600 mt-1">사람을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            가져오기
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            새 사람
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사람 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : persons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">등록된 사람이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>사번</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>생성일</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {persons.map((person) => (
                    <TableRow
                      key={person.personId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(person)}
                    >
                      <TableCell className="font-medium">{person.name}</TableCell>
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
                      <TableCell>
                        {person.currentDept ? (
                          <Badge variant="secondary">{person.currentDept}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    <TableCell>
                      {person.currentPosition ? (
                        <span className="text-sm">{person.currentPosition}</span>
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

      <PersonDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
      />

      <PersonDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        initialData={selectedPerson}
      />

      <PersonImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}
