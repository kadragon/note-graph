import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useDepartments } from '@/hooks/useDepartments';
import { CreateDepartmentDialog } from './components/CreateDepartmentDialog';

export default function Departments() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: departments = [], isLoading } = useDepartments();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">부서 관리</h1>
          <p className="text-gray-600 mt-1">부서를 관리하세요</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 부서
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>부서 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">부서가 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서명</TableHead>
                  <TableHead>생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(parseISO(dept.createdAt), 'yyyy-MM-dd HH:mm', {
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

      <CreateDepartmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
