# Plan

## Meeting Minutes Feature (2026-02-10)

- [x] Add migration test: schema includes `meeting_minutes`, `meeting_minute_person`, `meeting_minute_task_category`, and `work_note_meeting_minute` tables with required foreign keys and unique constraints.
- [x] Add migration test: schema includes indexes for `meeting_date`, attendee/category join tables, and work-note meeting links.
- [x] Add migration test: schema includes `meeting_minutes_fts` and insert/update/delete sync triggers.
- [x] Add schema validation test: create meeting minute requires `meetingDate`, `topic`, `detailsRaw`, and at least one `attendeePersonId`.
- [x] Add schema validation test: update meeting minute accepts partial payload but rejects invalid date/topic/details/attendee formats.
- [x] Add repository test: create meeting minute persists base fields plus attendee/category associations.
- [x] Add repository test: update meeting minute replaces attendee/category associations idempotently.
- [x] Add repository test: list meeting minutes supports `q`, date range, category, and attendee filters.
- [x] Add repository test: delete meeting minute cascades join rows and removes linked work-note references.
- [x] Add service test: keyword extraction normalizes and deduplicates AI output with max keyword count.
- [x] Add service test: keyword extraction falls back to deterministic keywords when AI response is invalid or fails.
- [x] Add route integration test: `POST /api/meeting-minutes` returns 201 with generated keywords and joined attendee/category payload.
- [x] Add route integration test: `GET /api/meeting-minutes` returns filtered paginated list with stable sort by `meetingDate`/`updatedAt`.
- [x] Add route integration test: `GET /api/meeting-minutes/:meetingId` returns full detail including attendees, categories, and keywords.
- [x] Add route integration test: `PUT /api/meeting-minutes/:meetingId` updates fields and re-generates keywords.
- [x] Add route integration test: `DELETE /api/meeting-minutes/:meetingId` returns 204 and removes the record.
- [x] Add suggestion route integration test: `POST /api/meeting-minutes/suggest` returns scored relevant meeting references from FTS.
- [x] Add work-note schema test: `createWorkNoteSchema` and `updateWorkNoteSchema` accept `relatedMeetingIds`.
- [x] Add work-note repository test: create work note persists `relatedMeetingIds` into `work_note_meeting_minute`.
- [x] Add work-note repository test: update work note replaces meeting links when `relatedMeetingIds` is provided.
- [x] Add work-note detail integration test: `GET /api/work-notes/:workId` includes linked meeting minute summaries.
- [x] Add AI draft route test: `POST /api/ai/work-notes/draft-from-text-with-similar` returns `meetingReferences` when suggestions exist.
- [x] Add API client test: meeting-minute CRUD/suggest methods map request/response payloads correctly.
- [x] Add hook test: `useMeetingMinutes` fetches/filter keys and respects enabled state.
- [x] Add hook test: meeting-minute create/update/delete mutations invalidate list/detail query keys.
- [x] Add page test: `/meeting-minutes` list renders, filters work, and opens create/edit dialogs.
- [x] Add dialog test: meeting-minute create form submits category + attendee IDs and renders returned keywords.
- [x] Add work-note create dialog test: selected meeting references are sent as `relatedMeetingIds` in create payload.
- [x] Add AI draft form test: auto-suggested meeting references are preselected and unchecked references are excluded on submit.
- [x] Add work-note detail dialog test: linked meeting minute section renders and links to meeting minute detail.
- [x] Add unified search integration test: `/api/search/unified` includes meeting minute result group with source-specific payload shape.
- [x] Add calendar-prefill integration test: calendar event to meeting-minute draft endpoint maps `date`, `summary`, and `description` correctly.
- [x] Add duplicate-guard test: create/update meeting minute warns or rejects when same date and highly similar topic already exists.
- [x] Add traceability test: meeting minute detail returns count of linked work notes.

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
