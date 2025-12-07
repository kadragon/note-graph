// Trace: SPEC-dept-1, TASK-022

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
import { useDepartments, useUpdateDepartment } from '@web/hooks/use-departments';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateDepartmentDialog } from './components/create-department-dialog';

export default function Departments() {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: departments = [], isLoading } = useDepartments();
  const updateDepartmentMutation = useUpdateDepartment();

  const handleToggleStatus = (deptName: string, currentStatus: boolean) => {
    updateDepartmentMutation.mutate({
      deptName,
      data: { isActive: !currentStatus },
    });
  };

  const handleViewMembers = (deptName: string) => {
    navigate(`/persons?dept=${encodeURIComponent(deptName)}`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">부서 관리</h1>
          <p className="page-description">부서를 관리하세요</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />새 부서
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
              <p className="text-sm text-muted-foreground">등록된 부서가 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서명</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.deptName} className={!dept.isActive ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{dept.deptName}</TableCell>
                    <TableCell>
                      <Badge variant={dept.isActive ? 'default' : 'secondary'}>
                        {dept.isActive ? '운영중' : '폐지됨'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(parseISO(dept.createdAt), 'yyyy-MM-dd HH:mm', {
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewMembers(dept.deptName)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          소속 직원
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(dept.deptName, dept.isActive)}
                          disabled={updateDepartmentMutation.isPending}
                        >
                          {dept.isActive ? '폐지' : '재개'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateDepartmentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
