import { StateRenderer } from '@web/components/state-renderer';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MeetingMinutesTable } from './components/meeting-minutes-table';

export default function MeetingMinutes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');

  const query = useMemo(
    () => ({
      q: q.trim() || undefined,
      page: 1,
      pageSize: 20,
    }),
    [q]
  );

  const { data, isLoading, error } = useMeetingMinutes(query);
  const items = data?.items ?? [];

  // Handle ?id=xxx query param — redirect to new URL
  const meetingIdFromUrl = searchParams.get('id');
  useEffect(() => {
    if (!meetingIdFromUrl || isLoading) return;
    setSearchParams({}, { replace: true });
    navigate(`/meeting-minutes/${meetingIdFromUrl}`, { replace: true });
  }, [meetingIdFromUrl, isLoading, setSearchParams, navigate]);

  const handleView = (meetingId: string) => {
    navigate(`/meeting-minutes/${meetingId}`);
  };

  const handleEdit = (meetingId: string) => {
    navigate(`/meeting-minutes/${meetingId}/edit`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">회의록</h1>
          <p className="page-description">회의 내용을 기록하고 업무노트와 연결하세요.</p>
        </div>
        <Button onClick={() => navigate('/meeting-minutes/new')}>
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
            error={error}
          >
            <MeetingMinutesTable items={items} onView={handleView} onEdit={handleEdit} />
          </StateRenderer>
        </CardContent>
      </Card>
    </div>
  );
}
