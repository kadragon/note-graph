// Trace: SPEC-stats-1, TASK-048
/**
 * Table showing work notes with completion statistics
 */

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WorkNoteStatisticsItem } from '@/types/api';

interface WorkNotesTableProps {
  workNotes: WorkNoteStatisticsItem[];
}

export function WorkNotesTable({ workNotes }: WorkNotesTableProps) {
  if (workNotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>업무노트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            선택한 기간에 완료된 할일이 있는 업무노트가 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>업무노트 목록 ({workNotes.length}건)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">제목</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead className="text-center">완료된 할일</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead>수정일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workNotes.map((workNote) => {
                const owners = workNote.assignedPersons.filter((p) => p.role === 'OWNER');

                return (
                  <TableRow key={workNote.workId}>
                    <TableCell className="font-medium">{workNote.title}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {workNote.category || '미분류'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {owners.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {owners.map((person) => (
                            <span key={person.personId} className="text-sm">
                              {person.personName}
                              {person.currentDept && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  ({person.currentDept})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{workNote.completedTodoCount}</span>
                      <span className="text-muted-foreground"> / {workNote.totalTodoCount}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(workNote.createdAt), 'yyyy.MM.dd', { locale: ko })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(workNote.updatedAt), 'yyyy.MM.dd', { locale: ko })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
