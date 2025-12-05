# Note Graph Frontend

Modern React frontend for the Note Graph application, built with Vite, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

### ✅ Implemented Pages

#### 1. Dashboard (대시보드)
- **Todo Management** with 5 views:
  - 오늘 (Today)
  - 이번 주 (This Week)
  - 이번 달 (This Month)
  - 백로그 (Backlog)
  - 전체 (All)
- **Features**:
  - Toggle todo status with checkboxes
  - Optimistic UI updates
  - Due date display with Korean locale
  - Recurrence indicators
  - Loading states
  - Empty states

### 🚧 Placeholder Pages

- Work Notes (업무노트)
- Persons (사람 관리)
- Departments (부서 관리)
- Search (검색)
- AI Chatbot (AI 챗봇)
- PDF Upload (PDF 업로드)

## Development

### Prerequisites
- Node.js >= 18.0.0
- Backend running on `localhost:8787` (Wrangler dev server)

### Start Development Server

```bash
# Start both frontend and backend
npm run dev

# Or start frontend only
cd apps/web && npm run dev
```

The Vite dev server will start on `http://localhost:5173` and automatically proxy API requests to the backend.

### Build

```bash
# Build frontend only
npm run build:frontend

# Build frontend + backend
npm run build
```

Build output is emitted to `dist/web/` (served by Wrangler assets binding).

## Project Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── toaster.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── features/
│   │   └── shared/
│   ├── pages/
│   │   └── Dashboard/
│   │       ├── Dashboard.tsx
│   │       ├── index.ts
│   │       └── components/
│   │           ├── TodoTabs.tsx
│   │           ├── TodoList.tsx
│   │           └── TodoItem.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── useTodos.ts
│   ├── lib/
│   │   ├── api.ts          # Type-safe API client
│   │   └── utils.ts        # Utility functions
│   ├── types/
│   │   └── api.ts          # TypeScript type definitions
│   ├── styles/
│   │   └── index.css       # Global styles + Tailwind
│   ├── App.tsx
│   └── main.tsx
├── index.html
└── public/                  # Static assets copied into build
```

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Routing**: React Router 7
- **State Management**: TanStack React Query 5
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: lucide-react
- **Date Formatting**: date-fns with Korean locale
- **Type Safety**: TypeScript 5.7

## Key Features

### Type-Safe API Client

All API endpoints are typed and available through the `API` object:

```typescript
import { API } from '@/lib/api';

// Fetch todos
const todos = await API.getTodos('today');

// Update todo status
await API.updateTodo(todoId, { status: 'completed' });
```

### React Query Integration

Server state is managed with TanStack React Query:

```typescript
import { useTodos, useToggleTodo } from '@/hooks/useTodos';

function MyComponent() {
  const { data: todos, isLoading } = useTodos('today');
  const toggleTodo = useToggleTodo();

  const handleToggle = (id: string) => {
    toggleTodo.mutate({ id, status: 'completed' });
  };

  // ...
}
```

### Optimistic Updates

Todo status changes are optimistically updated:
1. UI updates immediately when checkbox is clicked
2. Request is sent to backend
3. On error, changes are rolled back
4. On success, data is revalidated

### Toast Notifications

User feedback is provided through toast notifications:

```typescript
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleAction = () => {
    toast({
      title: "성공",
      description: "작업이 완료되었습니다.",
    });
  };

  // ...
}
```

## Component Usage

### shadcn/ui Components

All UI components are located in `src/components/ui/`:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
        <Checkbox id="example" />
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

## Testing

### Manual Testing

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Test Dashboard functionality:
   - Switch between todo views (Today, Week, Month, Backlog, All)
   - Toggle todo checkboxes
   - Verify optimistic updates
   - Check date formatting
   - Test loading states

## Bundle Size

Current build output (Phase 2):
- **Total**: ~120KB gzipped
- **Main bundle**: 287KB → 90KB gzipped
- **React vendor**: 43KB → 15KB gzipped
- **Query vendor**: 35KB → 10KB gzipped
- **CSS**: 20KB → 4KB gzipped

## Next Steps

### Priority Pages to Implement

1. **Work Notes** - Core CRUD functionality
2. **Persons** - Complex form with autocomplete
3. **Search** - Simpler implementation
4. **RAG Chatbot** - Chat interface
5. **PDF Upload** - File handling

### Additional Components Needed

As you implement more pages, you may need:
- Table (for data grids)
- Dialog (for modals)
- Textarea (for multi-line input)
- Select (for dropdowns)
- Badge (for status indicators)

## Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Router](https://reactrouter.com/)
- [date-fns](https://date-fns.org/)
- [Lucide Icons](https://lucide.dev/)
