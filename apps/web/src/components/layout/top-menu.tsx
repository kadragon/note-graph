import { Button } from '@web/components/ui/button';
import { toast } from '@web/hooks/use-toast';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { cn } from '@web/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BotMessageSquare,
  Building2,
  Calendar,
  ClipboardList,
  Cloud,
  DatabaseZap,
  FolderOpen,
  Home,
  Link,
  LogOut,
  NotebookPen,
  ScrollText,
  Search,
  Settings2,
  Tag,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { path: '/', label: '대시보드', icon: Home },
  { path: '/statistics', label: '통계', icon: BarChart3 },
  { path: '/work-notes', label: '업무노트', icon: NotebookPen },
  { path: '/meeting-minutes', label: '회의록', icon: ClipboardList },
  { path: '/task-categories', label: '업무 구분', icon: Tag },
  { path: '/work-note-groups', label: '업무 그룹', icon: FolderOpen },

  { path: '/persons', label: '사람 관리', icon: Users },
  { path: '/departments', label: '부서 관리', icon: Building2 },
  { path: '/search', label: '검색', icon: Search },
  { path: '/rag', label: 'AI 챗봇', icon: BotMessageSquare },
  { path: '/ai-logs', label: 'AI 로그', icon: ScrollText },
  { path: '/vector-store', label: '벡터 스토어', icon: DatabaseZap },
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
    try {
      await API.disconnectGoogle();
      await refreshDriveStatus();
    } catch {
      toast({
        title: '연결 해제 실패',
        description: 'Google 연결 해제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-6">
      <nav aria-label="주요 메뉴" className="flex items-center gap-2">
        {navItems.map((item) => (
          <NavLinkItem key={item.path} item={item} />
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
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleGoogleReconnect}
          disabled={!configured || isDriveChecking}
          aria-label="Google 연결하기"
          title="Google 연결하기"
          data-testid="google-connect-button"
        >
          <Link className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!isDriveConnected && !isCalendarConnected}
          data-testid="google-disconnect-button"
          onClick={handleGoogleDisconnect}
          aria-label="Google 연결 해제"
          title="Google 연결 해제"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

const NavLinkItem = React.memo(function NavLinkItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive
            ? 'bg-accent text-foreground shadow-sm ring-1 ring-ring/30 after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap rounded-md',
          'bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-visible:opacity-100'
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
});
