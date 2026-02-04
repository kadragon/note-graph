import { Button } from '@web/components/ui/button';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { cn } from '@web/lib/utils';
import { Calendar, CheckCircle2, Cloud, Settings2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: '대시보드' },
  { path: '/work-notes', label: '업무노트' },
  { path: '/persons', label: '사람 관리' },
];

const GOOGLE_AUTH_URL = '/api/auth/google/authorize';

export default function TopMenu() {
  const {
    configured,
    data: driveStatus,
    refetch: refreshDriveStatus,
    isFetching: isDriveChecking,
  } = useGoogleDriveConfigStatus();
  const isDriveConnected = driveStatus?.connected ?? false;
  const isCalendarConnected = driveStatus?.calendarConnected ?? false;
  const needsReauth = driveStatus?.needsReauth ?? false;

  const handleGoogleReconnect = async () => {
    const nextStatus = await refreshDriveStatus();
    if (
      !nextStatus.data?.connected ||
      !nextStatus.data?.calendarConnected ||
      nextStatus.data?.needsReauth
    ) {
      window.location.href = GOOGLE_AUTH_URL;
    }
  };

  const handleGoogleDisconnect = async () => {
    await API.disconnectGoogle();
    await refreshDriveStatus();
  };

  return (
    <div className="flex items-center gap-6">
      <nav aria-label="주요 메뉴" className="flex items-center gap-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Settings2
            className={cn('h-4 w-4', configured ? 'text-emerald-600' : 'text-muted-foreground')}
            aria-label={configured ? '환경 설정 완료' : '환경 설정 필요'}
          />
          <Cloud
            className={cn(
              'h-4 w-4',
              isDriveConnected && !needsReauth ? 'text-emerald-600' : 'text-muted-foreground'
            )}
            aria-label={
              !isDriveConnected
                ? 'Drive 미연결'
                : needsReauth
                  ? 'Drive 재연결 필요'
                  : 'Drive 연결됨'
            }
          />
          <Calendar
            className={cn(
              'h-4 w-4',
              isCalendarConnected ? 'text-emerald-600' : 'text-muted-foreground'
            )}
            aria-label={isCalendarConnected ? '캘린더 연결됨' : '캘린더 미연결'}
          />
          <CheckCircle2
            className={cn(
              'h-4 w-4',
              isDriveConnected && isCalendarConnected && !needsReauth
                ? 'text-emerald-600'
                : 'text-muted-foreground'
            )}
            aria-label={
              isDriveConnected && isCalendarConnected && !needsReauth
                ? '연결 상태 정상'
                : '연결 상태 확인 필요'
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleGoogleReconnect}
          disabled={!configured || isDriveChecking}
          data-testid="google-connect-button"
        >
          연결하기
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!isDriveConnected && !isCalendarConnected}
          data-testid="google-disconnect-button"
          onClick={handleGoogleDisconnect}
        >
          로그아웃
        </Button>
      </div>
    </div>
  );
}
