import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@web/components/ui/scroll-area';
import { useSidebar } from '@web/contexts/sidebar-context';
import { API } from '@web/lib/api';
import { cn } from '@web/lib/utils';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Notebook,
  Search,
  User,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

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
      <div className="border-t p-4">
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
      </div>
    </aside>
  );
}
