// Trace: SPEC-stats-1, TASK-048, TASK-054
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
  onSelect?: (workNoteId: string) => void;
}

export function WorkNotesTable({ workNotes, onSelect }: WorkNotesTableProps) {
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
                <TableHead className="w-[45%]">제목</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead className="text-center">완료된 할일</TableHead>
                <TableHead>수정일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workNotes.map((workNote) => {
                return (
                  <TableRow
                    key={workNote.workId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelect?.(workNote.workId)}
                  >
                    <TableCell className="font-medium">{workNote.title}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {workNote.categoryName || workNote.category || '미분류'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{workNote.completedTodoCount}</span>
                      <span className="text-muted-foreground"> / {workNote.totalTodoCount}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(workNote.updatedAt), 'yyyy-MM-dd', { locale: ko })}
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
