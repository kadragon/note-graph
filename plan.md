## AI Draft Pipeline - contentRaw truncation (1.2)

> findSimilarNotes()가 contentRaw 전체를 반환하지만, 프롬프트에서는 200-300자만 사용. 반환 시 content를 미리 truncate하여 불필요한 데이터 전송 제거.

- [x] findSimilarNotes()가 반환하는 content가 300자 이하로 truncate됨
- [x] 300자 미만 content는 truncate 없이 원본 그대로 반환

## AI Draft Pipeline - 라우트 병렬화 (1.1)

> 미들웨어로 순차 실행되던 독립 연산들을 핸들러 내부 Promise.all로 병렬화하여 레이턴시 감소.

- [x] draft-from-text-with-similar 라우트에서 categories, todoDueDateContext, similarNotes, meetingReferences가 병렬 실행됨
- [x] draft-from-text 라우트에서 categories, todoDueDateContext가 병렬 실행됨
- [x] enhance 라우트에서 findById, findByWorkId, findSimilarNotes, categories, todoDueDateContext가 병렬 실행됨 (findById 의존성 고려)
- [x] todo-suggestions 라우트에서 findById, todoDueDateContext가 병렬 실행됨
- [x] pdf 라우트에서 extraction 이후 todoDueDateContext, findSimilarNotes가 병렬 실행됨
- [x] 미들웨어 제거 후 Variables 타입에서 activeCategoryNames, todoDueDateContext 제거

## AI Draft Pipeline - callGPT 유틸리티 추출 (3.1)

> AIDraftService.callGPT()와 RagService.callGPT()의 중복 코드를 공통 유틸리티로 추출. RagService에 finish_reason 처리 및 usage 로깅 추가.

- [x] openai-chat.ts 유틸리티가 callOpenAIChat 함수를 export
- [x] AIDraftService가 공통 유틸리티를 사용
- [x] RagService가 공통 유틸리티를 사용하며 finish_reason: 'length' 처리 포함

## AI Draft Pipeline - System/User 메시지 분리 (2.1)

> 모든 프롬프트가 단일 user 메시지로 전송되는 것을 system/user로 분리하여 OpenAI system prompt caching 활용.

- [x] callOpenAIChat이 system + user 메시지 배열을 지원
- [x] constructDraftPrompt가 { system, user } 구조를 반환
- [x] constructDraftPromptWithContext가 { system, user } 구조를 반환
- [x] constructEnhancePrompt가 { system, user } 구조를 반환
- [x] constructTodoSuggestionsPrompt가 { system, user } 구조를 반환
- [x] constructRefinePrompt가 { system, user } 구조를 반환
- [x] RagService constructPrompt가 { system, user } 구조를 반환

## AI Draft Pipeline - 응답 파싱 중복 제거 (3.2)

> generateDraftFromText, generateDraftFromTextWithContext, enhanceExistingWorkNote의 JSON parse + validate + transform 코드를 callGPTAndParseDraft로 통합.

- [x] callGPTAndParseDraft private 메서드가 3개 메서드의 파싱 로직을 대체

## AI Draft Pipeline - todo 제한 + PDF truncation (2.2, 2.3)

> 유사 노트의 todo 전체 포함 → 5개 제한. PDF 추출 텍스트 길이 무제한 → 30,000자 제한.

- [x] 유사 노트당 todo가 최대 5개로 제한됨
- [x] PDF 추출 텍스트가 30,000자 초과 시 truncate됨

## AI Draft Pipeline - 토큰 사용량 로깅 (3.3)

> API 응답의 usage 필드를 활용하여 prompt_tokens, completion_tokens, total_tokens 로깅.

- [x] callOpenAIChat 호출 시 usage 정보가 로깅됨
