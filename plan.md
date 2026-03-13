## Supabase Auth 마이그레이션 — Phase 4: CF Access 제거

> Phase 0~2 완료 후 프로덕션에서 Supabase Auth 안정 확인되면 CF Access를 제거한다.

- [x] Cloudflare Dashboard에서 `note.kadragon.work` Access Application 삭제
- [x] `apps/worker/src/middleware/auth.ts`에서 CF Access 헤더 체크 제거 (Supabase JWT + dev fallback만 유지)
- [x] 프론트엔드에서 CF Access 관련 참조 최종 확인 및 제거
- [x] `.dev.vars.example`에서 CF Access 관련 주석 정리
- [x] `AGENTS.md`에서 "Auth: Cloudflare Access" → "Auth: Supabase Auth (Google OAuth)" 업데이트

## 회의록 키워드 추출 개선

> GPT 키워드 추출이 폴백으로 빠지는 원인을 파악하고, 프롬프트와 폴백 로직을 모두 개선하여 한국어 회의 내용에서 의미 있는 키워드가 추출되도록 한다.

### 1. GPT 호출 실패 디버깅

- [x] catch 블록에 에러 로깅 추가 (console.error 또는 적절한 로깅)하여 실패 원인 추적 가능하게
- [x] GPT 응답이 빈 keywords 배열일 때도 폴백으로 빠지지 않도록 방어 (기존 동작이 이미 올바름 — 빈 배열이면 폴백이 정상)

### 2. 프롬프트 개선

- [x] 한국어 회의록에 맞는 키워드 추출 지침 추가 (복합 명사, 전문 용어 우선, 조사/어미 제거 등)
- [x] 최대 키워드 수 명시 및 우선순위 기준 안내

### 3. 폴백 로직 개선

- [x] 한국어 불용어 리스트 추가 (조사, 접속사, 대명사 등)
- [x] 빈도 기반 정렬로 자주 등장하는 단어 우선 추출
- [x] 1글자 영어, 숫자만으로 된 토큰 필터링
