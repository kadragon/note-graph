import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

// Map paths to breadcrumb titles
const pathTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: '대시보드', subtitle: '할 일을 관리하세요' },
  '/work-notes': { title: '업무노트', subtitle: '업무노트를 관리하세요' },
  '/persons': { title: '사람 관리', subtitle: '사람을 관리하세요' },
  '/departments': { title: '부서 관리', subtitle: '부서를 관리하세요' },
  '/task-categories': { title: '업무 구분 관리', subtitle: '업무 구분을 관리하세요' },
  '/search': { title: '검색', subtitle: '업무노트를 검색하세요' },
  '/rag': { title: 'AI 챗봇', subtitle: 'AI와 대화하세요' },
};

// Check if element is an editable input field
function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageInfo = pathTitles[location.pathname] || { title: '페이지', subtitle: '' };

  // Global keyboard shortcut: Ctrl+K (or Cmd+K on Mac) or / to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Check for / key (only when not in an input/textarea)
      if (e.key === '/' && !isEditableElement(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      void navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
    // Escape key to blur the search input
    if (e.key === 'Escape') {
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="hidden md:block">
          <h1 className="text-lg font-semibold">{pageInfo.title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="검색... (⌘/Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-64 pl-8 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>
    </header>
  );
}
