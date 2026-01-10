# Coverage Improvement Plan

## Current Status
- Overall: 70.23% statements, 54.28% branches, 54.28% functions, 70.23% lines
- Worker backend: **100% coverage** (all modules fully tested)
- Web app: **0% coverage** (no React component tests)
- Shared types: 0% (type definitions, no runtime code)

## Coverage Gaps Analysis

### Actual Gap Source
The 30% coverage gap comes entirely from the Web app:
- **113 TypeScript/React files** with zero test coverage
- Pages: RAG (219 lines), Work Notes (214 lines), PDF Upload (161 lines), Task Categories (149 lines)
- Hooks: 15 custom hooks (use-todos.ts, use-work-notes.ts, use-pdf.ts, etc.)
- Components: Layout, Dashboard, UI components (18 shadcn/ui components)
- Utilities: api.ts, date-utils.ts, utils.ts, mappers

### What's Already Covered (100%)
- All Worker middleware (error-handler.ts, validation-middleware.ts, etc.)
- All Worker repositories (8 files)
- All Worker services (16 files)
- All Worker routes (11 files)
- All Worker schemas (9 files)
- All Worker utils (ai-gateway.ts, r2-access.ts, etc.)

## Implementation Plan

### Phase 1: React Testing Infrastructure Setup
Goal: Enable React component testing

#### Task 1.1: Install Testing Dependencies
- [x] Install @testing-library/react, @testing-library/user-event, @testing-library/dom
- [x] Install jsdom for DOM environment
- **Command**: `bun add -D @testing-library/react @testing-library/user-event @testing-library/dom jsdom`

#### Task 1.2: Configure Vitest for React
- [x] Create separate vitest config for web app (vitest.config.web.ts)
- [x] Configure jsdom environment for React tests
- [x] Add test script for web app in package.json
- **Files to create**: vitest.config.web.ts

#### Task 1.3: Create Test Utilities
- [x] Create test setup file for React (mock providers, render utilities)
- [x] Create mock factories for API types (WorkNote, Todo, Department, etc.)
- [x] Create mock for @tanstack/react-query
- **Files to create**: apps/web/src/test/setup.ts, apps/web/src/test/factories.ts

### Phase 2: Custom Hooks Testing
Goal: Branches 54% → 62%, Functions 54% → 62%

#### Task 2.1: Core Data Hooks
- [ ] Test use-todos.ts (fetch, create, update, delete, toggle)
- [ ] Test use-work-notes.ts (CRUD, filtering, sorting, stats)
- [ ] Test use-projects.ts (CRUD, participants, work note association)
- [ ] Test use-persons.ts (fetch, search, filtering)
- **Files to create**: apps/web/src/hooks/__tests__/*.test.ts
- **Expected impact**: +8 functions, +20 branches

#### Task 2.2: Feature Hooks
- [ ] Test use-pdf.ts (upload, progress tracking, error handling)
- [ ] Test use-search.ts (query, results, pagination)
- [ ] Test use-rag.ts (chat interactions, streaming, error handling)
- [ ] Test use-ai-draft.ts (draft generation, form integration)
- **Expected impact**: +6 functions, +15 branches

#### Task 2.3: Utility Hooks
- [ ] Test use-departments.ts (fetch, tree structure)
- [ ] Test use-task-categories.ts (CRUD operations)
- [ ] Test use-sidebar-collapse.ts (state persistence)
- [ ] Test use-toast.ts (show/hide, variants)
- [ ] Test use-debounced-value.ts (debounce behavior)
- **Expected impact**: +6 functions, +10 branches

### Phase 3: Page Component Testing
Goal: Branches 62% → 68%, Functions 62% → 68%

#### Task 3.1: Core Pages
- [ ] Test work-notes.tsx (list display, filtering, CRUD actions)
- [ ] Test dashboard.tsx (rendering, data fetching, layout)
- [ ] Test projects.tsx (project management, participants)
- [ ] Test persons.tsx (CRUD operations, search, department filter)
- **Files to create**: apps/web/src/pages/__tests__/*.test.tsx
- **Expected impact**: +10 functions, +25 branches

#### Task 3.2: Feature Pages
- [ ] Test pdf-upload.tsx (file selection, upload progress, success/error)
- [ ] Test search.tsx (search query, results display, pagination)
- [ ] Test rag.tsx (chat interface, message display, streaming)
- [ ] Test statistics.tsx (chart rendering, date filtering)
- **Expected impact**: +8 functions, +20 branches

#### Task 3.3: Management Pages
- [ ] Test task-categories.tsx (CRUD operations)
- [ ] Test departments.tsx (tree view, CRUD)
- **Expected impact**: +4 functions, +10 branches

### Phase 4: Layout & Utility Testing
Goal: Branches 68% → 70%, Functions 68% → 70%

#### Task 4.1: Layout Components
- [ ] Test app-layout.tsx (sidebar/header rendering, responsive)
- [ ] Test sidebar.tsx (navigation, collapsible sections, active state)
- [ ] Test header.tsx (title, search, navigation)
- **Files to create**: apps/web/src/components/__tests__/*.test.tsx
- **Expected impact**: +5 functions, +12 branches

#### Task 4.2: Utility Functions
- [ ] Test api.ts (all endpoint functions, error handling)
- [ ] Test date-utils.ts (formatting, parsing, edge cases)
- [ ] Test utils.ts (cn utility, object merging)
- [ ] Test mappers/department.ts (data transformation)
- **Note**: Some tests already exist - extend coverage
- **Expected impact**: +4 functions, +8 branches

### Phase 5: Coverage Threshold Update
- [ ] Analyze final coverage metrics
- [ ] Update vitest.config.ts thresholds:
  - Statements: 70 (maintain)
  - Branches: 65 (increase from 53)
  - Functions: 65 (increase from 53)
  - Lines: 70 (maintain)
- [ ] Document coverage exclusions (CSS-only, type exports)

## Success Criteria
- Final coverage: 70+ statements, 65+ branches, 65+ functions, 70+ lines
- All API routes: 100% (already achieved)
- All backend services: 100% (already achieved)
- All custom hooks: 90%+
- Core pages: 85%+
- Test execution time < 60 seconds

## Notes
- Worker backend testing is complete - no additional work needed
- Focus exclusively on Web app testing
- packages/shared/types can be excluded (type definitions only)
- UI library components (shadcn/ui) don't need unit tests - test integration instead
