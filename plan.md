# Plan

## Work Note AI Enhance Reference Fixes (2026-02-09)

- [ ] Add hook test: `useEnhanceWorkNoteForm` stores AI references and initializes `selectedReferenceIds` to all AI reference IDs.
- [ ] Add hook test: toggling AI reference selection updates `selectedReferenceIds` and preserves unchecked state.
- [ ] Add hook test: submit payload merges `baseRelatedWorkIds` with selected AI references and excludes unchecked AI references in `relatedWorkIds`.
- [ ] Add hook test: submit invalidates `['work-note-detail', workId]` and `['work-note-todos', workId]` (no stale `['work-note', workId]` key).
- [ ] Add preview dialog test: `AIReferenceList` is controlled by form state (`selectedReferenceIds`) and updates via form action (`setSelectedReferenceIds`).
- [ ] Implement form state/actions: add `references`, `selectedReferenceIds`, and `baseRelatedWorkIds` handling in `useEnhanceWorkNoteForm`.
- [ ] Implement submit logic: compute final `relatedWorkIds` using "기존 유지 + AI 선택 반영(체크=추가, 해제=제외)" and include it in `API.updateWorkNote`.
- [ ] Implement cache refresh fixes: invalidate `work-note-detail`, `work-note-todos`, `work-notes`, `work-notes-with-stats`, and `todos` after successful apply.
- [ ] Implement preview wiring: pass `existingRelatedWorkIds` from `ViewWorkNoteDialog` to `EnhancePreviewDialog`, and wire `AIReferenceList` selection callbacks.
