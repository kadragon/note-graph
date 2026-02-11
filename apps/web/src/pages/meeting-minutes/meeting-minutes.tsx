import { StateRenderer } from '@web/components/state-renderer';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { useDialogState } from '@web/hooks/use-dialog-state';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateMeetingMinuteDialog } from './components/create-meeting-minute-dialog';
import { EditMeetingMinuteDialog } from './components/edit-meeting-minute-dialog';
import { MeetingMinutesTable } from './components/meeting-minutes-table';

export default function MeetingMinutes() {
  const createDialog = useDialogState();
  const editDialog = useDialogState<string>();
  const [q, setQ] = useState('');

  const query = useMemo(
    () => ({
      q: q.trim() || undefined,
      page: 1,
      pageSize: 20,
    }),
    [q]
  );

  const { data, isLoading } = useMeetingMinutes(query);
  const items = data?.items ?? [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">회의록</h1>
          <p className="page-description">회의 내용을 기록하고 업무노트와 연결하세요.</p>
        </div>
        <Button onClick={createDialog.open}>
          <Plus className="h-4 w-4 mr-2" />새 회의록
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>회의록 목록</CardTitle>
          <div className="max-w-sm">
            <Input
              aria-label="검색어"
              placeholder="토픽/내용 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <StateRenderer
            isLoading={isLoading}
            isEmpty={items.length === 0}
            emptyMessage="등록된 회의록이 없습니다."
          >
            <MeetingMinutesTable items={items} onEdit={editDialog.open} />
          </StateRenderer>
        </CardContent>
      </Card>

      <CreateMeetingMinuteDialog
        open={createDialog.isOpen}
        onOpenChange={createDialog.onOpenChange}
      />
      <EditMeetingMinuteDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        meetingId={editDialog.id ?? undefined}
      />
    </div>
  );
}
