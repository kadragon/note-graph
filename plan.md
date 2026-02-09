# Plan

## Work Note AI Enhance Reference Fixes (2026-02-09)

- [x] Add hook test: `useEnhanceWorkNoteForm` stores AI references and initializes `selectedReferenceIds` to all AI reference IDs.
- [x] Add hook test: toggling AI reference selection updates `selectedReferenceIds` and preserves unchecked state.
- [x] Add hook test: submit payload merges `baseRelatedWorkIds` with selected AI references and excludes unchecked AI references in `relatedWorkIds`.
- [x] Add hook test: submit invalidates `['work-note-detail', workId]` and `['work-note-todos', workId]` (no stale `['work-note', workId]` key).
- [x] Add preview dialog test: `AIReferenceList` is controlled by form state (`selectedReferenceIds`) and updates via form action (`setSelectedReferenceIds`).
- [x] Implement form state/actions: add `references`, `selectedReferenceIds`, and `baseRelatedWorkIds` handling in `useEnhanceWorkNoteForm`.
- [x] Implement submit logic: compute final `relatedWorkIds` using "Keep existing + Reflect AI selection (checked=add, unchecked=remove)" and include it in `API.updateWorkNote`.
- [x] Implement cache refresh fixes: invalidate `work-note-detail`, `work-note-todos`, `work-notes`, `work-notes-with-stats`, and `todos` after successful apply.
- [x] Implement preview wiring: pass `existingRelatedWorkIds` from `ViewWorkNoteDialog` to `EnhancePreviewDialog`, and wire `AIReferenceList` selection callbacks.

## Todo Edit Dialog Date Clamp (2026-02-09)

- [x] EditTodoDialog: waitUntil 변경 시 dueDate가 비었거나 더 이르면 dueDate를 waitUntil로 자동 보정
- [x] EditTodoDialog: 저장 시 dueDate < waitUntil이면 dueDate를 waitUntil로 보정해 전송
