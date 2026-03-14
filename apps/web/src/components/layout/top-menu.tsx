import { Button } from '@web/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@web/components/ui/popover';
import { toast } from '@web/hooks/use-toast';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { cn } from '@web/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  BotMessageSquare,
  Building2,
  Calendar,
  ClipboardList,
  Cloud,
  FolderOpen,
  Home,
  Link,
  ListTree,
  LogOut,
  NotebookPen,
  Search,
  Settings,
  Settings2,
  Tag,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  group: number;
};

const navItems: NavItem[] = [
  { path: '/', label: '대시보드', icon: Home, group: 0 },
  { path: '/work-notes', label: '업무노트', icon: NotebookPen, group: 0 },
  { path: '/meeting-minutes', label: '회의록', icon: ClipboardList, group: 0 },
  { path: '/daily-report', label: '일일 리포트', icon: BookOpen, group: 0 },
  { path: '/search', label: '검색', icon: Search, group: 1 },
  { path: '/rag', label: 'AI 챗봇', icon: BotMessageSquare, group: 1 },
  { path: '/statistics', label: '통계', icon: BarChart3, group: 1 },
];

const manageItems: NavItem[] = [
  { path: '/task-categories', label: '업무 구분', icon: Tag, group: 0 },
  { path: '/work-note-groups', label: '업무 그룹', icon: FolderOpen, group: 0 },
  { path: '/persons', label: '사람 관리', icon: Users, group: 0 },
  { path: '/departments', label: '부서 관리', icon: Building2, group: 0 },
];

const navGroups = Object.values(
  navItems.reduce<Record<number, NavItem[]>>((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {})
);

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
      nextStatus.data?.needsReauth ||
      !nextStatus.data?.connected ||
      !nextStatus.data?.calendarConnected
    ) {
      // Use dedicated OAuth flow to (re)authorize without replacing app session
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
        {navGroups.map((group, groupIndex) => (
          <React.Fragment key={group[0].path}>
            {groupIndex > 0 && <div className="w-px h-5 bg-border mx-1" />}
            {group.map((item) => (
              <NavLinkItem key={item.path} item={item} />
            ))}
          </React.Fragment>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <ManageMenu />
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
        <NavLink
          to="/settings"
          aria-label="설정"
          title="설정"
          className={({ isActive }) =>
            cn(
              'flex h-8 w-8 items-center justify-center rounded-md',
              isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <Settings className="h-4 w-4" />
        </NavLink>
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

function ManageMenu() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const isActive = manageItems.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: close popover on route change
  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="관리"
          title="관리"
          className={cn(
            'group relative flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isActive
              ? 'bg-accent text-foreground shadow-sm ring-1 ring-ring/30 after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <ListTree className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        {manageItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: linkActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  linkActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </PopoverContent>
    </Popover>
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
