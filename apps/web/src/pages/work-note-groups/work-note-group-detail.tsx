import { Button } from '@web/components/ui/button';
import { useWorkNoteGroupWorkNotes } from '@web/hooks/use-work-note-groups';
import { formatDateTimeInKstOrFallback } from '@web/lib/date-format';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function WorkNoteGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workNotesQuery = useWorkNoteGroupWorkNotes(id, Boolean(id));

  if (!id) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">업무 그룹 ID가 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/work-note-groups')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  if (workNotesQuery.isLoading) {
    return (
      <div className="page-container flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (workNotesQuery.isError) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">업무노트 목록을 불러오지 못했습니다.</p>
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" onClick={() => void workNotesQuery.refetch()}>
            다시 시도
          </Button>
          <Button variant="outline" onClick={() => navigate('/work-note-groups')}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const workNotes = workNotesQuery.data ?? [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <h1 className="page-title">업무 그룹 업무노트</h1>
        </div>
      </div>

      {workNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">연결된 업무노트가 없습니다.</p>
      ) : (
        <ul className="grid gap-2">
          {workNotes.map((workNote) => (
            <li key={workNote.workId} className="flex items-center justify-between gap-2 text-sm">
              <Link to={`/work-notes/${workNote.workId}`} className="font-medium hover:underline">
                {workNote.title}
              </Link>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatDateTimeInKstOrFallback(workNote.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
