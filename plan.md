# Front-End Refactoring Plan

## Executive Summary

Comprehensive analysis of `apps/web/src/` completed. The codebase has **177 TypeScript/React files** across **44 directories**. Overall structure is **solid and scalable** with well-defined patterns. Several areas for improvement identified, prioritized by impact.

---

## Analysis Summary

### What's Working Well

1. **Clean Architecture**: Feature-scoped pages with dedicated components, hooks, and utilities
2. **React Query Patterns**: Excellent query/mutation separation with optimistic updates
3. **Type Safety**: Centralized API types with TypeScript strict mode
4. **Naming Conventions**: Consistent kebab-case files, PascalCase components, `use*` hooks
5. **UI Primitives**: Well-designed Shadcn/ui (Radix + Tailwind) component library
6. **Code Splitting**: Lazy loading of pages via `React.lazy()`
7. **Hook Testing**: 22 test files covering queries, mutations, and error states

### Key Findings by Category

| Category | Rating | Main Issues |
|----------|--------|-------------|
| Component Patterns | 8/10 | Large ViewWorkNoteDialog needs extraction |
| Hooks & State | 8.5/10 | Mutation boilerplate duplication (~30 hooks) |
| Testing | 7.5/10 | Good hook coverage; sparse page/component tests |
| Code Organization | 8/10 | Types file too large; scattered config |
| Accessibility | 7/10 | Some icon-only buttons lack aria-labels |
| Performance | 8/10 | Good lazy loading; optimistic updates in place |

---

## Refactoring Tasks

### Phase 1: High Priority (Reduce Duplication & Improve Maintainability)

#### 1.1 Extract Mutation Hook Factory
- [x] Create `lib/hooks/create-standard-mutation.ts` factory function
- [x] Refactor 30+ identical mutation hooks to use factory
- [x] Reduce boilerplate from ~25 lines to ~5 lines per mutation

**Current Pattern (repeated 30+ times):**
```typescript
export function useCreatePerson() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data) => API.createPerson(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
      toast({ title: '성공', description: '사람이 추가되었습니다.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: '오류', description: error.message || '...' });
    },
  });
}
```

**Target Pattern:**
```typescript
export const useCreatePerson = createStandardMutation({
  mutationFn: API.createPerson,
  invalidateKeys: [['persons']],
  messages: { success: '사람이 추가되었습니다.', error: '사람을 추가할 수 없습니다.' }
});
```

#### 1.2 Split Large Types File
- [x] Create `types/models/` directory
- [x] Move WorkNote types to `types/models/work-note.ts`
- [x] Move Todo types to `types/models/todo.ts`
- [x] Move Person types to `types/models/person.ts`
- [x] Move request/response types to `types/requests.ts`
- [x] Keep `types/api.ts` as barrel export only

#### 1.3 Centralize Configuration
- [x] Create `lib/config.ts` with all magic numbers
- [x] Move API timeout, staleTime, retry counts to config
- [x] Move search debounce, limits to config
- [x] Move CF Access token refresh settings to config

---

### Phase 2: Component Extraction (Improve Readability)

#### 2.1 Break Up ViewWorkNoteDialog
- [x] Extract `TodoCreationForm` component (~80 lines)
- [x] Extract `WorkNoteEditForm` component (~100 lines)
- [x] Extract `CategorySelector` component (~40 lines)
- [x] Create `useTodoForm` hook for todo state management

#### 2.2 Extract Dialog State Pattern
- [x] Create `useDialogState(id?)` hook
- [x] Apply to create/edit/view dialogs across pages
- [x] Reduces dialog open/close/reset boilerplate

#### 2.3 Create State Renderer Component
- [x] Create `components/state-renderer.tsx`
- [x] Handle loading/empty/error states uniformly
- [x] Replace scattered ternary conditionals

---

### Phase 3: Accessibility Improvements

#### 3.1 Icon Button Labels
- [x] Add `aria-label` to icon-only buttons in `ProjectsTable`
- [x] Add `aria-label` to icon-only buttons in `WorkNotesTable`
- [x] Add `aria-label` to sidebar collapse button
- [x] Add `aria-label` to file action buttons

#### 3.2 Form Labels
- [x] Ensure all inputs have associated labels
- [x] Add `autocomplete` attributes to form inputs
- [x] Verify keyboard navigation in dialogs

---

### Phase 4: Testing Coverage Expansion

#### 4.1 Component Tests (Currently 56%)
- [x] Add tests for `assignee-selector.tsx`
- [x] Add tests for `draft-editor-form.tsx`
- [x] Add tests for `lazy-markdown.tsx`
- [x] Add tests for `ai-reference-list.tsx`

#### 4.2 Page Tests (Currently 26%)
- [x] Add tests for `dashboard.tsx`
- [x] Add tests for `vector-store.tsx`
- [x] Expand dialog interaction tests

#### 4.3 Missing Utility Tests
- [x] Add tests for `get-latest-todo-date.ts`

---

### Phase 5: Code Organization (Nice-to-Have)

#### 5.1 Consolidate Mappers
- [x] Move `transformWorkNoteFromBackend` to `lib/mappers/work-note.ts`
- [x] Move `transformTodoFromBackend` to `lib/mappers/todo.ts`
- [x] Remove transformation methods from APIClient

#### 5.2 Add Error Boundaries
- [x] Create `ErrorBoundary` component
- [x] Wrap page routes with error boundary
- [x] Add fallback UI for error states

#### 5.3 Document Conventions
- [x] Create `docs/ARCHITECTURE.md`
- [x] Document import order rules
- [x] Document component patterns
- [x] Document hook naming conventions

---

## Web Interface Guidelines Compliance

### Items to Address

| Guideline | Status | File(s) |
|-----------|--------|---------|
| Icon buttons need `aria-label` | ⚠️ Fix | `projects-table.tsx`, `work-notes-table.tsx` |
| Form inputs need `autocomplete` | ⚠️ Check | Various dialogs |
| Honor `prefers-reduced-motion` | ✅ OK | Tailwind handles |
| Virtualize lists >50 items | ⚠️ Consider | Work notes table |
| Loading states end with `…` | ✅ OK | Consistent |
| Use `tabular-nums` for numbers | ⚠️ Add | Statistics, tables |

---

## React Best Practices Compliance (Vercel Guidelines)

### Already Applied
- ✅ `bundle-dynamic-imports` - Pages lazy loaded
- ✅ `async-parallel` - Promise.allSettled for todo creation
- ✅ `rerender-lazy-state-init` - Lazy useState used
- ✅ `client-swr-dedup` - React Query handles deduplication

### Opportunities
- ⚠️ `bundle-barrel-imports` - Consider direct imports from UI components
- ⚠️ `rerender-memo` - Extract expensive list items to memoized components
- ⚠️ `rendering-content-visibility` - Add to long tables

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | 3 major refactors | Medium-High |
| Phase 2 | 4 extractions | Medium |
| Phase 3 | 4 accessibility fixes | Low |
| Phase 4 | 7 test additions | Medium |
| Phase 5 | 5 improvements | Low-Medium |

---

## Completed Tasks (Previous)
- [x] Change 1: Add formatPhoneExt utility and use in formatPersonBadge
- [x] Change 4: Make upload button icon-only with loading indicator
- [x] Change 3: Reorder folder path buttons + icon-only copy button
- [x] Change 2: Make referenced work notes clickable (with query param support)
- [x] Person List UI: Column width consistency, phone prefix omission, currentRoleDesc display
- [x] Work Note List UI: Compact 1-line rows (title truncate, assignee format, due date color gradient, created date format)

---

## Feature: Work Note AI-Assisted Update

### Overview

Add an "AI로 업데이트" (Update with AI) feature to existing work notes that allows users to add new content (text or files) and have AI intelligently merge it with the existing work note while preserving all existing todos.

### User Flow

1. Open work note detail dialog
2. Click "AI로 업데이트" button (next to edit button)
3. Enhancement input dialog opens:
   - Text input area for new content
   - File upload option (PDF, HWP, etc.) - text extracted and merged
4. Click "생성" → AI processes and returns enhanced draft
5. Preview dialog shows:
   - Editable enhanced content (title, content, categories)
   - Suggested new todos (checkboxes)
   - Existing todos label (preserved, read-only)
6. User reviews, edits if needed, selects new todos to add
7. Click "적용" → work note updated, new todos created, existing todos preserved

### Implementation Tasks

#### Phase A: Backend API

- [x] **A.1** Add enhance endpoint schema (`apps/worker/src/schemas/ai-draft.ts`)
  - `enhanceWorkNoteRequestSchema` with newContent, generateNewTodos fields

- [x] **A.2** Add enhance method to AIDraftService (`apps/worker/src/services/ai-draft-service.ts`)
  - `enhanceExistingWorkNote()` method
  - `constructEnhancePrompt()` method with Korean prompt that:
    - Receives existing work note + new content
    - Instructs AI to merge/enhance (not replace)
    - Preserves key information from original
    - Suggests only NEW todos (not duplicates of existing)

- [x] **A.3** Add enhance route (`apps/worker/src/routes/ai-draft.ts`)
  - `POST /ai/work-notes/:workId/enhance` endpoint
  - Accepts multipart form data (text + optional file)
  - If file uploaded: extract text using PdfExtractionService
  - Combine text input + extracted file text as newContent
  - Fetches existing work note and its todos
  - Calls `findSimilarNotes()` for context
  - Returns `{ enhancedDraft, originalContent, existingTodos, references }`

#### Phase B: Shared Types

- [x] **B.1** Add enhance types (`packages/shared/types/search.ts`)
  - `EnhanceWorkNoteRequest` interface
  - `EnhanceWorkNoteResponse` interface

#### Phase C: Frontend API & Hooks

- [x] **C.1** Add API method (`apps/web/src/lib/api.ts`)
  - `enhanceWorkNote(workId, data): Promise<EnhanceWorkNoteResponse>`

- [x] **C.2** Add types (`apps/web/src/types/api.ts`)
  - `EnhanceWorkNoteRequest`, `EnhanceWorkNoteResponse`

- [x] **C.3** Create enhance hook (`apps/web/src/hooks/use-enhance-work-note.ts`)
  - `useEnhanceWorkNote()` mutation hook for calling enhance API
  - `useEnhanceWorkNoteForm()` hook managing:
    - Enhanced draft state (title, content, categoryIds, personIds)
    - Suggested new todos (checkboxes)
    - Existing todos display (read-only, preserved)
    - Submit handler that updates work note + creates selected new todos

#### Phase D: Frontend UI Components

- [x] **D.1** Create enhance input dialog (`apps/web/src/pages/work-notes/components/enhance-work-note-dialog.tsx`)
  - Textarea for new content input
  - File upload button (PDF, HWP supported) with file name display
  - "생성" button to call enhance API (sends form data)
  - Loading state during AI processing (file extraction + AI)

- [x] **D.2** Create enhance preview dialog (`apps/web/src/pages/work-notes/components/enhance-preview-dialog.tsx`)
  - Shows enhanced content (editable)
  - Shows suggested new todos (checkbox list)
  - Shows existing todos (greyed out, label: "기존 할일 유지됨")
  - "적용" / "취소" buttons

- [x] **D.3** Update view work note dialog (`apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx`)
  - Add "AI로 업데이트" button next to Edit button in header
  - Wire up dialog open state for enhance flow

### Key Design Decisions

1. **Content merging**: AI generates unified enhanced content, not simple append
2. **File extraction**: PDF/HWP files are text-extracted and merged with text input
3. **Todo preservation**: ALL existing todos preserved (any status)
4. **New todos only**: AI suggests only new todos, avoiding duplicates
5. **Simple preview**: Show editable enhanced content only (no side-by-side diff)
6. **Two-step confirmation**: Input dialog → Preview dialog for safety
7. **Pattern reuse**: Follow `useAIDraftForm` and `PdfExtractionService` patterns

### Critical Files to Modify

| File | Changes |
|------|---------|
| `apps/worker/src/services/ai-draft-service.ts` | Add enhance methods |
| `apps/worker/src/routes/ai-draft.ts` | Add enhance endpoint |
| `apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx` | Add enhance button |
| `apps/web/src/lib/api.ts` | Add API method |
| `apps/web/src/hooks/use-enhance-work-note.ts` | New hook file |

### Verification Plan

1. **Unit tests**: Test enhance prompt generation and response parsing
2. **Integration test**: Full flow from input → AI → apply
3. **Manual verification**:
   - Create work note with 3 todos (1 completed)
   - Use enhance feature with new content
   - Verify: content merged, completed todo preserved, new todos added
   - Re-embedding triggered after update

---

## Next Steps

1. Review this plan and prioritize tasks
2. Start with Phase A.1 (Backend Schema) for the AI Update feature
3. Proceed through phases in order
4. Mark tasks complete as they are implemented

---

*Generated: 2026-01-31*
*Analysis performed by: 4 parallel exploration agents + Web/React best practices review*
