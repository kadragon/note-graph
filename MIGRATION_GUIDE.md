# React + shadcn/ui Migration Guide

## Overview

This document outlines the migration from vanilla JavaScript to React + shadcn/ui for the note-graph frontend application.

## Phase 1: Project Setup ✅ COMPLETED

### What Was Done

1. **Dependencies Installed**
   - React 19.2.0 + React DOM
   - React Router DOM 7.9.6
   - TanStack React Query 5.90.10
   - Vite 7.2.2 (build tool)
   - Tailwind CSS 3.4.0
   - shadcn/ui components (via Radix UI)
   - TypeScript support for React

2. **Configuration Files Created**
   - `vite.config.ts` - Vite build configuration with proxy to backend
   - `tailwind.config.js` - Tailwind CSS v3 configuration
   - `postcss.config.js` - PostCSS configuration
   - `tsconfig.app.json` - Frontend TypeScript configuration
   - `tsconfig.backend.json` - Backend TypeScript configuration
   - `components.json` - shadcn/ui configuration

3. **Directory Structure**
   ```
   frontend/
   ├── src/
   │   ├── components/
   │   │   ├── ui/              # shadcn/ui components
   │   │   │   ├── button.tsx
   │   │   │   ├── card.tsx
   │   │   │   ├── input.tsx
   │   │   │   ├── label.tsx
   │   │   │   ├── toast.tsx
   │   │   │   └── toaster.tsx
   │   │   ├── layout/          # Layout components
   │   │   │   ├── AppLayout.tsx
   │   │   │   └── Sidebar.tsx
   │   │   ├── features/        # Feature-specific components
   │   │   └── shared/          # Shared components
   │   ├── pages/               # Page components (placeholders)
   │   ├── hooks/               # Custom React hooks
   │   │   └── use-toast.ts
   │   ├── lib/
   │   │   ├── api.ts           # Type-safe API client
   │   │   └── utils.ts         # Utility functions (cn)
   │   ├── types/
   │   │   └── api.ts           # TypeScript type definitions
   │   ├── styles/
   │   │   └── index.css        # Global styles + Tailwind
   │   ├── App.tsx              # Main app component with routing
   │   └── main.tsx             # Entry point
   ├── index.html               # HTML entry point
   └── public/                  # Build output (git-ignored)
   ```

4. **Core Infrastructure Created**
   - **API Client** (`lib/api.ts`): Type-safe API client with all endpoints
   - **Type Definitions** (`types/api.ts`): Complete TypeScript types for all API entities
   - **React Router**: Setup with all 7 pages/routes
   - **React Query**: Configured for data fetching and caching
   - **Toast System**: Complete toast notification system
   - **Layout System**: AppLayout with Sidebar navigation

5. **Updated Scripts**
   ```json
   {
     "dev": "concurrently \"npm:dev:frontend\" \"npm:dev:backend\"",
     "dev:frontend": "vite",
     "dev:backend": "wrangler dev",
     "build": "vite build && tsc --project tsconfig.backend.json",
     "build:frontend": "vite build",
     "preview": "vite preview",
     "deploy": "npm run build && wrangler deploy"
   }
   ```

## Current State

### ✅ Working
- Frontend builds successfully (244KB main bundle, gzipped to 77KB)
- Code splitting: react-vendor (43KB), query-vendor (33KB)
- TypeScript compilation for both frontend and backend
- Development environment setup (Vite dev server on :5173, Wrangler on :8787)
- API proxy configuration from frontend to backend
- All 7 page routes created (placeholder pages)
- Sidebar navigation with lucide-react icons
- User authentication display in sidebar
- shadcn/ui components ready for use

### 📝 Page Placeholders Created
All pages have placeholder implementations with proper routing:
1. `/` - Dashboard (대시보드)
2. `/work-notes` - Work Notes (업무노트)
3. `/persons` - Persons (사람 관리)
4. `/departments` - Departments (부서 관리)
5. `/search` - Search (검색)
6. `/rag` - AI Chatbot (AI 챗봇)
7. `/pdf` - PDF Upload (PDF 업로드)

## Next Steps - Phase 2: Page Implementation

### Priority 1: Dashboard (Todo Management)
**Files to create:**
- `frontend/src/pages/Dashboard/Dashboard.tsx`
- `frontend/src/pages/Dashboard/components/TodoTabs.tsx`
- `frontend/src/pages/Dashboard/components/TodoList.tsx`
- `frontend/src/pages/Dashboard/components/TodoItem.tsx`
- `frontend/src/hooks/useTodos.ts`

**shadcn/ui components needed:**
- Tabs (already have basic structure)
- Checkbox (need to create)

**Features to implement:**
- Tab navigation (Today, Week, Month, Backlog, All)
- Todo list with checkboxes
- Status toggle with optimistic updates
- Recurrence display

### Priority 2: Work Notes
**Files to create:**
- `frontend/src/pages/WorkNotes/WorkNotes.tsx`
- `frontend/src/pages/WorkNotes/components/WorkNotesTable.tsx`
- `frontend/src/pages/WorkNotes/components/CreateWorkNoteDialog.tsx`
- `frontend/src/hooks/useWorkNotes.ts`

**shadcn/ui components needed:**
- Table (need to create)
- Dialog (have basic structure)
- Textarea (need to create)

**Features to implement:**
- Work notes table with view/delete actions
- Create work note dialog
- Category badges
- Date formatting (using date-fns)

### Priority 3-7: Other Pages
Similar structure for:
- Persons (complex form with autocomplete)
- Departments
- Search (simpler implementation)
- RAG Chatbot (chat interface)
- PDF Upload (file dropzone)

## Technical Decisions Made

### 1. Build Tool: Vite
- Fast HMR (Hot Module Replacement)
- Modern ES modules
- Excellent TypeScript support
- Built-in code splitting

### 2. Styling: Tailwind CSS v3 + shadcn/ui
- Utility-first CSS
- Design system with CSS variables
- shadcn/ui for pre-built accessible components
- Korean font support maintained

### 3. State Management
- TanStack React Query for server state
- React hooks for local state
- No global state library needed (yet)

### 4. Icons: lucide-react
- Replaced emoji icons (📊, 📄) with professional SVG icons
- Tree-shakeable
- Consistent design

### 5. TypeScript
- Full type safety across frontend and backend
- Shared type definitions possible
- Better IDE support

### 6. Routing: React Router v7
- Client-side routing (SPA)
- Browser history API
- No hash-based routing

## Development Workflow

### Starting Development
```bash
# Start both frontend and backend together
npm run dev

# Or start separately:
npm run dev:frontend  # Vite on http://localhost:5173
npm run dev:backend   # Wrangler on http://localhost:8787
```

### Building for Production
```bash
# Build frontend + backend
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Project Structure Notes
- Frontend code: `frontend/src/`
- Backend code: `src/` (unchanged)
- Build output: `public/` (serves as static assets for Cloudflare Workers)
- Old frontend files: `public/js/app.js`, `public/css/styles.css` (can be removed after migration)

## API Integration

The API client (`frontend/src/lib/api.ts`) provides type-safe methods for all endpoints:

```typescript
// Example usage in a component
import { useQuery, useMutation } from '@tanstack/react-query';
import { API } from '@/lib/api';

// Fetch data
const { data: workNotes, isLoading } = useQuery({
  queryKey: ['work-notes'],
  queryFn: () => API.getWorkNotes(),
});

// Mutate data
const createMutation = useMutation({
  mutationFn: (data) => API.createWorkNote(data),
  onSuccess: () => {
    queryClient.invalidateQueries(['work-notes']);
  },
});
```

## Component Usage

### Using shadcn/ui components
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>제목</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="name">이름</Label>
          <Input id="name" placeholder="이름을 입력하세요" />
        </div>
        <Button>저장</Button>
      </CardContent>
    </Card>
  );
}
```

### Using Toast notifications
```tsx
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleClick = () => {
    toast({
      title: "성공",
      description: "작업이 완료되었습니다.",
    });
  };

  return <Button onClick={handleClick}>클릭</Button>;
}
```

## Migration Strategy

### Parallel Development Approach
1. Keep old frontend (`public/js/app.js`) functional during migration
2. Implement new React pages one by one
3. Test each page thoroughly before moving to the next
4. Once all pages are migrated, remove old files

### Testing Each Page
1. Build frontend: `npm run build:frontend`
2. Start backend: `npm run dev:backend`
3. Test all features work correctly
4. Check mobile responsiveness
5. Verify API integration

## Bundle Size Analysis

Current build output:
- **Total**: ~295KB (uncompressed), ~107KB (gzipped)
- **Main bundle**: 244KB → 77KB gzipped
- **React vendor**: 43KB → 15KB gzipped
- **Query vendor**: 33KB → 10KB gzipped
- **CSS**: 17KB → 4KB gzipped

This is within acceptable limits for a modern SPA.

## Known Issues & Notes

1. **Cloudflare Workers routing**: The backend needs to serve `index.html` for all non-API routes to support SPA routing
2. **Korean localization**: All UI text is currently hardcoded in Korean
3. **Dark mode**: CSS variables are prepared but dark mode toggle not implemented
4. **Mobile responsiveness**: Sidebar needs mobile menu implementation

## Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Router Documentation](https://reactrouter.com/)

## Summary

Phase 1 (Project Setup) is **complete**. The foundation is solid and ready for page implementation. All core infrastructure is in place:
- ✅ Build system configured
- ✅ TypeScript types defined
- ✅ API client created
- ✅ Routing setup
- ✅ UI component library ready
- ✅ Layout and navigation implemented

You can now proceed with Phase 2: implementing the actual page functionality, starting with the Dashboard (Todo management) page.
