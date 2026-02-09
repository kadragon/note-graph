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

## Project Attachments: R2 -> Google Drive

- [ ] Add repository unit test: `ProjectRepository.getFiles` maps Drive fields and `storageType` for mixed `R2/GDRIVE` rows.
- [ ] Add repository unit test: project statistics include both legacy `R2` and `GDRIVE` active files in `totalFiles/totalFileSize`.

- [ ] Add projects route integration test: `POST /api/projects/:projectId/files` returns Drive-backed file payload.
- [ ] Add projects route integration test: `GET /api/projects/:projectId/files` returns Drive metadata fields.
- [ ] Add projects route integration test: `GET /api/projects/:projectId/files/:fileId/download` redirects for `GDRIVE` and streams for legacy `R2`.
- [ ] Add projects route integration test: `DELETE /api/projects/:projectId/files/:fileId` deletes Drive file.
- [ ] Add projects route integration test: `POST /api/projects/:projectId/files/migrate` migrates legacy R2 files and returns summary.
- [ ] Add projects route integration test: `DELETE /api/projects/:projectId` cleans Drive folder and soft-deletes project.

- [ ] Add web API client test: project file download opens Drive link path for `GDRIVE` and keeps Blob download for `R2`.
- [ ] Add `use-projects` mutation test: migrate hook invalidates `project-files` and `project` queries and shows summary toast.
- [ ] Add `ProjectFiles` component test: Drive file row renders external-link action instead of Blob download action.
- [ ] Add `ProjectFiles` component test: legacy R2 file row still supports direct download action.
- [ ] Add `ProjectFiles` component test: migration button appears when legacy R2 files exist and triggers migrate flow.

- [ ] Add end-to-end integration test: mixed storage project shows consistent behavior across upload/list/download/delete/migrate.
