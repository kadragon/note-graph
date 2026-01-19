import { useQuery } from '@tanstack/react-query';
import { Button } from '@web/components/ui/button';
import { ScrollArea } from '@web/components/ui/scroll-area';
import { useSidebar } from '@web/contexts/sidebar-context';
import { toast } from '@web/hooks/use-toast';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { cn } from '@web/lib/utils';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Notebook,
  Search,
  User,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const GOOGLE_AUTH_URL = '/api/auth/google/authorize';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: '홈',
    items: [
      {
        path: '/',
        label: '대시보드',
        icon: LayoutDashboard,
      },
      {
        path: '/statistics',
        label: '통계',
        icon: BarChart3,
      },
    ],
  },
  {
    title: '업무 관리',
    items: [
      {
        path: '/work-notes',
        label: '업무노트',
        icon: FileText,
      },
      {
        path: '/task-categories',
        label: '업무 구분',
        icon: FolderKanban,
      },
      {
        path: '/projects',
        label: '프로젝트',
        icon: BriefcaseBusiness,
      },
    ],
  },
  {
    title: '조직 관리',
    items: [
      {
        path: '/persons',
        label: '사람 관리',
        icon: User,
      },
      {
        path: '/departments',
        label: '부서 관리',
        icon: Building2,
      },
    ],
  },
  {
    title: 'AI 도구',
    items: [
      {
        path: '/search',
        label: '검색',
        icon: Search,
      },
      {
        path: '/rag',
        label: 'AI 챗봇',
        icon: MessageSquare,
      },
      {
        path: '/vector-store',
        label: '벡터 스토어',
        icon: Database,
      },
    ],
  },
];

export default function Sidebar() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => API.getMe(),
  });

  const { isCollapsed } = useSidebar();

  const {
    configured,
    data: driveStatus,
    refetch: refreshDriveStatus,
    isFetching: isDriveChecking,
  } = useGoogleDriveConfigStatus();
  const isDriveConnected = driveStatus?.connected ?? false;
  const isCalendarConnected = driveStatus?.calendarConnected ?? false;

  const handleGoogleReconnect = async () => {
    const nextStatus = await refreshDriveStatus();
    if (!nextStatus.data?.connected || !nextStatus.data?.calendarConnected) {
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
    <aside
      data-collapsed={isCollapsed}
      className={cn(
        'fixed top-0 left-0 h-screen w-sidebar flex flex-col bg-background border-r',
        'transition-transform duration-300 ease-in-out',
        'data-[collapsed=true]:-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Notebook className="h-4 w-4" />
          </div>
          <span className="text-lg">업무노트</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h4>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0 opacity-0 transition-all',
                          'group-hover:opacity-100'
                        )}
                      />
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* User Section */}
      <div className="border-t p-4 space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">
              {user?.email ? user.email.split('@')[0] : '사용자'}
            </p>
            {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </div>

        <div className="space-y-2 px-1">
          <div className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-2 text-xs',
                configured ? 'text-muted-foreground' : 'text-amber-600 font-medium'
              )}
              data-testid="drive-config-badge"
            >
              {configured ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              <span>{configured ? '환경 설정 완료' : '환경 설정 필요'}</span>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 text-xs',
                isDriveConnected ? 'text-emerald-600 font-medium' : 'text-amber-600'
              )}
              data-testid="drive-connection-badge"
            >
              <Cloud className="h-3 w-3" />
              <span>{isDriveConnected ? 'Drive 연결됨' : 'Drive 미연결'}</span>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 text-xs',
                isCalendarConnected ? 'text-emerald-600 font-medium' : 'text-amber-600'
              )}
              data-testid="calendar-connection-badge"
            >
              <Calendar className="h-3 w-3" />
              <span>{isCalendarConnected ? '캘린더 연결됨' : '캘린더 미연결'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-full justify-start h-7 text-xs',
                isDriveConnected && isCalendarConnected
                  ? 'text-emerald-600 hover:text-emerald-700'
                  : 'text-amber-600'
              )}
              onClick={handleGoogleReconnect}
              disabled={!configured || isDriveChecking}
              title={
                !configured
                  ? 'Google OAuth 설정이 필요합니다'
                  : isDriveConnected && isCalendarConnected
                    ? '연결 상태 확인'
                    : 'Google OAuth 연결하기'
              }
              data-testid="google-connect-button"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              {isDriveConnected && isCalendarConnected ? '연결 확인' : '연결하기'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-7 text-xs text-muted-foreground"
              onClick={handleGoogleDisconnect}
              disabled={!isDriveConnected && !isCalendarConnected}
              title="Google OAuth 연결 해제"
              data-testid="google-disconnect-button"
            >
              <LogOut className="h-3 w-3 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
