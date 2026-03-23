## Review Backlog

### PR #384 — Batch meeting embedding and SSE improvements (2026-03-22)

- [x] `processChunkBatch` 에러 타입의 `workId` 필드명을 제네릭 `itemId`로 변경 — `embedding-processor.ts` (source: Claude)
- [x] `openai-chat.test.ts`에 model 파라미터 로깅 검증 테스트 추가 — `tests/unit/openai-chat.test.ts` (source: Claude)

### PR #385 — Add PDF agent draft generation (2026-03-22)

- [x] `generate`/`generateFromPDF` 상태 관리 보일러플레이트를 헬퍼로 추출 — `apps/web/src/hooks/use-agent-draft.ts` (source: Gemini)
- [x] PDF 텍스트 30,000자 초과 시 잘림 알림 progress 이벤트 전송 — `apps/worker/src/routes/ai-draft.ts:211` (source: Claude)
