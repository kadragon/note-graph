import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FileText,
  User,
  Building2,
  Search,
  MessageSquare,
  Paperclip,
  Notebook,
} from 'lucide-react';
import { API } from '@/lib/api';

const navItems = [
  {
    path: '/',
    label: '대시보드',
    icon: LayoutDashboard,
  },
  {
    path: '/work-notes',
    label: '업무노트',
    icon: FileText,
  },
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
    path: '/pdf',
    label: 'PDF 업로드',
    icon: Paperclip,
  },
];

export default function Sidebar() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => API.getMe(),
  });

  return (
    <aside className="fixed top-0 left-0 h-screen w-sidebar bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Notebook className="w-6 h-6" />
          업무노트
        </h1>
        <div className="px-3 py-2 bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-600">
            {user?.email || 'Loading...'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
