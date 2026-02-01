# Frontend Architecture

This document describes the architectural patterns and conventions used in the web application.

## Directory Structure

```
apps/web/src/
├── components/          # Shared UI components
│   ├── ui/             # Shadcn/ui primitives (Button, Dialog, etc.)
│   └── __tests__/      # Component tests
├── hooks/              # Shared custom hooks
│   └── __tests__/      # Hook tests
├── lib/                # Utilities and services
│   ├── config.ts       # Centralized configuration
│   ├── api.ts          # API client
│   └── mappers/        # Data transformation functions
├── pages/              # Feature-scoped page modules
│   └── [feature]/
│       ├── index.tsx           # Page component (default export)
│       ├── components/         # Feature-specific components
│       ├── hooks/              # Feature-specific hooks
│       └── __tests__/          # Feature tests
├── types/              # TypeScript type definitions
│   ├── api.ts          # Barrel export for all types
│   └── models/         # Domain model types
└── test/               # Test utilities and setup
```

## Import Order Convention

Imports should be ordered as follows:

1. **External dependencies** (React, libraries)
2. **Internal types** (`@web/types/...`)
3. **Internal services/utilities** (`@web/lib/...`, `@web/hooks/...`)
4. **Internal components** (`@web/components/...`)
5. **Relative imports** (`./`, `../`)

Example:
```typescript
// 1. External dependencies
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal types
import type { WorkNote } from '@web/types/api';

// 3. Internal services/utilities
import { API } from '@web/lib/api';
import { useToast } from '@web/hooks/use-toast';

// 4. Internal components
import { Button } from '@web/components/ui/button';
import { StateRenderer } from '@web/components/state-renderer';

// 5. Relative imports
import { WorkNoteCard } from './work-note-card';
```

## Component Patterns

### File Naming
- Use **kebab-case** for all file names: `work-note-card.tsx`
- Use **PascalCase** for component names: `WorkNoteCard`
- Test files: `component-name.test.tsx`

### Component Structure
```typescript
// Props interface
interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

// Component with explicit return type
export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div>
      <h1>{title}</h1>
      {onAction && <Button onClick={onAction}>Action</Button>}
    </div>
  );
}
```

### State Rendering Pattern
Use `StateRenderer` for consistent loading/empty/error states:
```typescript
<StateRenderer
  isLoading={isLoading}
  isEmpty={data.length === 0}
  error={error}
  emptyMessage="데이터가 없습니다."
>
  {/* Content */}
</StateRenderer>
```

### Dialog State Pattern
Use `useDialogState` for consistent dialog management:
```typescript
const { isOpen, selectedId, open, close } = useDialogState<string>();
```

## Hook Naming Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `use[Entity]s` | Fetch list of entities | `useWorkNotes()` |
| `use[Entity]` | Fetch single entity | `useWorkNote(id)` |
| `useCreate[Entity]` | Create mutation | `useCreateWorkNote()` |
| `useUpdate[Entity]` | Update mutation | `useUpdateWorkNote()` |
| `useDelete[Entity]` | Delete mutation | `useDeleteWorkNote()` |
| `use[Feature]Form` | Form state management | `useTodoForm()` |
| `useDialogState` | Dialog open/close state | `useDialogState()` |

### Mutation Hook Factory
Use `createStandardMutation` for standard CRUD mutations:
```typescript
export const useCreatePerson = createStandardMutation({
  mutationFn: API.createPerson,
  invalidateKeys: [['persons']],
  messages: {
    success: '추가되었습니다.',
    error: '추가할 수 없습니다.',
  },
});
```

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API.ts    │────▶│   Mapper    │────▶│  Component  │
│  (Backend)  │     │ (Transform) │     │   (View)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    BackendWorkNote
                           │
                           ▼
                       WorkNote
                    (Frontend Model)
```

- **API Client** (`lib/api.ts`): Handles HTTP requests and response parsing
- **Mappers** (`lib/mappers/`): Transform backend responses to frontend models
- **React Query**: Manages caching, refetching, and state synchronization

## Error Handling

### Error Boundary
All page routes are wrapped with `ErrorBoundary` for graceful error recovery:
```typescript
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <Routes>...</Routes>
  </Suspense>
</ErrorBoundary>
```

### API Errors
- Use `ApiError` class for typed error handling
- Toast notifications for user-facing error messages
- CF Access token refresh handled automatically

## Testing Conventions

### Test File Location
- Component tests: `__tests__/component-name.test.tsx`
- Hook tests: `__tests__/hook-name.test.ts`
- Utility tests: `utility-name.test.ts` (co-located)

### Test Patterns
```typescript
import { render, screen } from '@web/test/setup';
import { describe, expect, it } from 'vitest';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

### Hook Testing
```typescript
import { renderHookWithClient } from '@web/test/setup';

it('fetches data on mount', async () => {
  const { result } = renderHookWithClient(() => useMyHook());
  await waitFor(() => expect(result.current.data).toBeDefined());
});
```

## Performance Patterns

- **Lazy Loading**: Pages loaded via `React.lazy()`
- **React Query**: Automatic deduplication and caching
- **Optimistic Updates**: For mutation responsiveness
- **Suspense**: Concurrent rendering with fallbacks
