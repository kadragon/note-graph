import { Button } from '@web/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import type { API } from '@web/lib/api';

type MeetingMinuteListItem = Awaited<ReturnType<typeof API.getMeetingMinutes>>['items'][number];

interface MeetingMinutesTableProps {
  items: MeetingMinuteListItem[];
  onView: (meetingId: string) => void;
  onEdit: (meetingId: string) => void;
}

export function MeetingMinutesTable({ items, onView, onEdit }: MeetingMinutesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>회의일</TableHead>
          <TableHead>토픽</TableHead>
          <TableHead className="text-right">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.meetingId}>
            <TableCell>{item.meetingDate}</TableCell>
            <TableCell>{item.topic}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(item.meetingId)}
                >
                  보기
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item.meetingId)}
                >
                  수정
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
