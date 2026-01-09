import { Table, TableBody, TableHead, TableHeader, TableRow } from '@web/components/ui/table';
import type { WorkNoteWithStats } from '@web/types/api';
import { WorkNoteRow } from './work-note-row';

interface WorkNotesTableProps {
  workNotes: WorkNoteWithStats[];
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
}

export function WorkNotesTable({ workNotes, onView, onDelete }: WorkNotesTableProps) {
  if (workNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">업무노트가 없습니다.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead>업무 구분</TableHead>
          <TableHead>담당자</TableHead>
          <TableHead>할일</TableHead>
          <TableHead>마감일</TableHead>
          <TableHead>생성일</TableHead>
          <TableHead className="text-right">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workNotes.map((workNote) => (
          <WorkNoteRow key={workNote.id} workNote={workNote} onView={onView} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  );
}
