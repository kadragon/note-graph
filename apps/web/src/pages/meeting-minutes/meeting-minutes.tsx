import { StateRenderer } from '@web/components/state-renderer';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { useDialogState } from '@web/hooks/use-dialog-state';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreateMeetingMinuteDialog } from './components/create-meeting-minute-dialog';
import { EditMeetingMinuteDialog } from './components/edit-meeting-minute-dialog';
import { MeetingMinutesTable } from './components/meeting-minutes-table';
import { ViewMeetingMinuteDialog } from './components/view-meeting-minute-dialog';

export default function MeetingMinutes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createDialog = useDialogState();
  const viewDialog = useDialogState<string>();
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

  const meetingIdFromUrl = searchParams.get('id');
  useEffect(() => {
    if (!meetingIdFromUrl || isLoading) {
      return;
    }

    viewDialog.open(meetingIdFromUrl);
    setSearchParams({}, { replace: true });
  }, [meetingIdFromUrl, isLoading, setSearchParams, viewDialog.open]);

  const handleView = (meetingId: string) => {
    viewDialog.open(meetingId);
  };

  const handleEdit = (meetingId: string) => {
    editDialog.open(meetingId);
  };

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
            <MeetingMinutesTable items={items} onView={handleView} onEdit={handleEdit} />
          </StateRenderer>
        </CardContent>
      </Card>

      <CreateMeetingMinuteDialog
        open={createDialog.isOpen}
        onOpenChange={createDialog.onOpenChange}
      />
      <ViewMeetingMinuteDialog
        open={viewDialog.isOpen}
        onOpenChange={viewDialog.onOpenChange}
        meetingId={viewDialog.id ?? undefined}
        onEdit={(meetingId) => {
          viewDialog.onOpenChange(false);
          editDialog.open(meetingId);
        }}
      />
      <EditMeetingMinuteDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        meetingId={editDialog.id ?? undefined}
      />
    </div>
  );
}
