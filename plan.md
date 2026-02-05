# Plan

- [x] Add a top navigation component that renders the sidebar menu links (test: top menu shows key links like "대시보드", "업무노트", "사람 관리").
- [x] Move Google auth status badges into the top menu and keep the "환경 설정 필요" state disabling connect/disconnect buttons.
- [x] Top menu connect button refreshes status and redirects to `/api/auth/google/authorize` when not fully connected.
- [x] Top menu disconnect button calls `API.disconnectGoogle` and refreshes status.
- [x] AppLayout renders the top menu and no longer renders the sidebar toggle button.
- [x] Embed the top menu inside the header (test: header renders the top menu).
- [x] Replace Google auth status text with icon-only indicators (test: status text not shown; icons present with labels).
- [x] Remove top-bar hide/collapse plumbing (test: no sidebar collapse hook/context used in layout).
- [x] Skip Drive listing when no linked Drive folder ID exists (return empty list instead of calling Drive).
- [ ] Refactor remaining WorkNoteRepository queries (findByIds, findTodosByWorkIds, findByIdsWithDetails) to use `json_each` instead of chunked `IN (...)` to avoid SQL variable overflow.

---

## Completed (Archive)

### Front-End Refactoring (2026-01-31)
- Phase 1: Mutation Hook Factory, Split Types File, Centralize Configuration
- Phase 2: Component Extraction (ViewWorkNoteDialog, DialogState, StateRenderer)
- Phase 3: Accessibility Improvements (aria-labels, form labels)
- Phase 4: Testing Coverage Expansion
- Phase 5: Code Organization (mappers, error boundaries, docs)

### Work Note AI-Assisted Update (2026-01-31)
- Backend: enhance endpoint, AIDraftService.enhanceExistingWorkNote()
- Frontend: EnhanceWorkNoteDialog, EnhancePreviewDialog, useEnhanceWorkNote hook
- Integration: "AI로 업데이트" button in ViewWorkNoteDialog
