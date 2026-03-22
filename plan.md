## WorkNoteService.update: findById 중복 호출 제거

> needsReEmbedding 시 findById가 update 전후로 2회 호출됨. repository.update에 기존 WorkNote를 전달받는 옵션을 추가하여 1회로 줄인다.

- [x] repository.update()가 optional로 previousWorkNote를 받아 내부 findById를 skip하도록 변경
- [x] service.update()에서 needsReEmbedding 시 조회한 previousWorkNote를 repository.update()에 전달
- [x] 기존 테스트 통과 확인

## Review Backlog

### PR #380 — Switch AI email reply to SSE streaming (2026-03-21)

- [x] SSE 스트리밍 응답에 `X-Accel-Buffering: no` 헤더 추가 (nginx 프록시 대응) — `apps/worker/src/utils/openai-chat.ts:createSSEProxy` (source: Claude)
- [x] `callOpenAIChatStream` 토큰 사용량 로깅 포맷을 `callOpenAIChat`과 통일 — `apps/worker/src/utils/openai-chat.ts` (source: Claude)

### PR #382 — Add meeting minutes embedding support (2026-03-22)

- [x] `embedPendingMeetings`를 work note처럼 배치 전략으로 변경 (순차→배치) — `embedding-processor.ts:767` (source: Gemini)
- [x] 스케줄 핸들러에서 `embedPending`/`embedPendingMeetings`를 `Promise.all`로 병렬 실행 — `index.ts:216-236` (source: Gemini)
- [x] 미팅 업데이트 시 콘텐츠 미변경 시에도 `embedded_at = NULL` 리셋되는 문제 — `meeting-minute-repository.ts:177` (source: Claude)
- [x] `chunkMeetingMinute`와 `chunkWorkNote` 간 중복 로직 공통 헬퍼 추출 — `chunking-service.ts:109-175` (source: Claude, Gemini)
- [x] `embedPendingMeetings`와 `embedPending` 간 중복 로직 제네릭 추상화 — `embedding-processor.ts:808` (source: Gemini)
- [x] Todo 텍스트가 `estimateChunkCount`에 미반영 (chunk boundary 근처 orphaned chunk 가능) — `chunking-service.ts:60-63` (source: Codex)

### PR #383 — Add agentic draft generation with tool-calling loop (2026-03-22)

- [x] `useAgentDraft`의 `reset()`에 AbortController 추가하여 실제 fetch 취소 구현 — `apps/web/src/hooks/use-agent-draft.ts` (source: Claude)
- [x] `fetchAgentSSE` SSE 파서에서 `currentEventType`을 data 처리 후에도 리셋 (방어적 코딩) — `apps/web/src/lib/api.ts` (source: Claude)

### PR #384 — Batch meeting embedding and SSE improvements (2026-03-22)

- [ ] `processChunkBatch` 에러 타입의 `workId` 필드명을 제네릭 `itemId`로 변경 — `embedding-processor.ts` (source: Claude)
- [ ] `openai-chat.test.ts`에 model 파라미터 로깅 검증 테스트 추가 — `tests/unit/openai-chat.test.ts` (source: Claude)

### PR #385 — Add PDF agent draft generation (2026-03-22)

- [ ] `generate`/`generateFromPDF` 상태 관리 보일러플레이트를 헬퍼로 추출 — `apps/web/src/hooks/use-agent-draft.ts` (source: Gemini)
- [ ] PDF 텍스트 30,000자 초과 시 잘림 알림 progress 이벤트 전송 — `apps/worker/src/routes/ai-draft.ts:211` (source: Claude)
