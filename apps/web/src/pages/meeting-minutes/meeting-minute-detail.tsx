import { Button } from '@web/components/ui/button';
import { useMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { formatDateTimeInKstOrFallback } from '@web/lib/date-format';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const LazyMarkdown = lazy(() =>
  import('@web/components/lazy-markdown').then((m) => ({ default: m.LazyMarkdown }))
);

export default function MeetingMinuteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detailQuery = useMeetingMinute(id, Boolean(id));

  if (!id) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">회의록 ID가 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/meeting-minutes')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="page-container flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">회의록 정보를 불러오지 못했습니다.</p>
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" onClick={() => void detailQuery.refetch()}>
            다시 시도
          </Button>
          <Button variant="outline" onClick={() => navigate('/meeting-minutes')}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const meeting = detailQuery.data;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <div>
            <h1 className="page-title">{meeting.topic}</h1>
            <p className="page-description">
              생성일: {formatDateTimeInKstOrFallback(meeting.createdAt)} | 수정일:{' '}
              {formatDateTimeInKstOrFallback(meeting.updatedAt)}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/meeting-minutes/${id}/edit`)}>수정</Button>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {meeting.linkedWorkNoteCount !== undefined && (
          <p className="text-sm text-muted-foreground">
            연결된 업무노트: {meeting.linkedWorkNoteCount}건
          </p>
        )}

        <div className="grid gap-1">
          <p className="text-sm font-medium">회의일</p>
          <p className="text-sm">{meeting.meetingDate}</p>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">토픽</p>
          <p className="text-sm">{meeting.topic}</p>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">회의 내용</p>
          <div className="prose prose-sm leading-relaxed max-w-none border rounded-md p-4 bg-muted/50">
            <Suspense fallback={<div className="text-muted-foreground">로딩 중...</div>}>
              <LazyMarkdown>{meeting.detailsRaw.replace(/\n/g, '  \n')}</LazyMarkdown>
            </Suspense>
          </div>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">참석자</p>
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.length > 0 ? (
              meeting.attendees.map((attendee) => (
                <span
                  key={attendee.personId}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  {attendee.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">참석자가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">업무 구분</p>
          <div className="flex flex-wrap gap-2">
            {meeting.categories.length > 0 ? (
              meeting.categories.map((category) => (
                <span
                  key={category.categoryId}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  {category.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">업무 구분이 없습니다.</p>
            )}
          </div>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">업무 그룹</p>
          <div className="flex flex-wrap gap-2">
            {meeting.groups && meeting.groups.length > 0 ? (
              meeting.groups.map((group) => (
                <span
                  key={group.groupId}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  {group.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">업무 그룹이 없습니다.</p>
            )}
          </div>
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">키워드</p>
          <div className="flex flex-wrap gap-2">
            {meeting.keywords.length > 0 ? (
              meeting.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  {keyword}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">키워드가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
