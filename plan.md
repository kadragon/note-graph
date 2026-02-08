# Plan

## Project Attachments: R2 -> Google Drive

- [x] Add migration test: `project_files` accepts Drive metadata columns and `storage_type` default remains `R2`.
- [x] Add migration test: `project_gdrive_folders` table is created with `project_id` PK and cascade FK.
- [x] Add migration test: indexes for `project_files(storage_type)` and `project_files(gdrive_file_id)` are created.

- [x] Add `GoogleDriveService` unit test: `getOrCreateProjectFolder` creates `YYYY` folder under `GDRIVE_ROOT_FOLDER_ID` using project `created_at`.
- [x] Add `GoogleDriveService` unit test: `getOrCreateProjectFolder` creates project folder under year folder using `project_id` name.
- [x] Add `GoogleDriveService` unit test: existing `project_gdrive_folders` row is reused and re-parented into year folder when needed.
- [x] Add `GoogleDriveService` unit test: missing project row throws an explicit error in `getOrCreateProjectFolder`.

- [x] Add `ProjectFileService` unit test: upload stores file in Drive and persists `storage_type='GDRIVE'` with Drive IDs/links.
- [x] Add `ProjectFileService` unit test: upload still runs embedding flow and sets `embedded_at` for text-extractable files.
- [x] Add `ProjectFileService` unit test: upload fails fast with configuration error when Drive env vars are missing.
- [x] Add `ProjectFileService` unit test: download URL for `GDRIVE` file returns project download route without requiring R2 object.
- [x] Add `ProjectFileService` unit test: `R2` legacy file download URL behavior remains unchanged.
- [x] Add `ProjectFileService` unit test: delete removes Drive file when `storage_type='GDRIVE'`.
- [x] Add `ProjectFileService` unit test: delete removes R2 object when `storage_type='R2'`.
- [x] Add `ProjectFileService` unit test: migrateR2FilesToDrive converts only legacy R2 files and updates DB metadata.
- [x] Add `ProjectFileService` unit test: migrateR2FilesToDrive skips entries with missing R2 object and reports skipped count.
- [x] Add `ProjectFileService` unit test: migrateR2FilesToDrive rolls back uploaded Drive file when DB update fails.
- [x] Add `ProjectFileService` unit test: project cleanup deletes Drive folder when project has linked Drive folder.

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

---

## Completed (Archive)

### Previous Backlog (Archived)
- [x] Add a top navigation component that renders the sidebar menu links (test: top menu shows key links like "대시보드", "업무노트", "사람 관리").
- [x] Move Google auth status badges into the top menu and keep the "환경 설정 필요" state disabling connect/disconnect buttons.
- [x] Top menu connect button refreshes status and redirects to `/api/auth/google/authorize` when not fully connected.
- [x] Top menu disconnect button calls `API.disconnectGoogle` and refreshes status.
- [x] AppLayout renders the top menu and no longer renders the sidebar toggle button.
- [x] Embed the top menu inside the header (test: header renders the top menu).
- [x] Replace Google auth status text with icon-only indicators (test: status text not shown; icons present with labels).
- [x] Remove top-bar hide/collapse plumbing (test: no sidebar collapse hook/context used in layout).
- [x] Skip Drive listing when no linked Drive folder ID exists (return empty list instead of calling Drive).
- [x] Refactor remaining WorkNoteRepository queries (findByIds, findTodosByWorkIds, findByIdsWithDetails) to use `json_each` instead of chunked `IN (...)` to avoid SQL variable overflow.

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
