## Google OAuth 통합: Supabase 로그인 시 Drive + Calendar 권한 함께 획득

> 싱글유저 시스템에서 Google 로그인 시 Drive/Calendar 스코프를 함께 요청하여, 별도 OAuth 플로우 없이 한 번에 토큰을 획득한다.

### 1. Backend: POST /auth/google/store-tokens 엔드포인트

- [x] POST /store-tokens가 accessToken, refreshToken으로 토큰 저장 성공 (200)
- [x] POST /store-tokens에서 refreshToken이 null이면 기존 refresh token 유지
- [x] POST /store-tokens에서 accessToken 누락 시 400 반환
- [x] POST /store-tokens에서 Google tokeninfo로 scope 확인 후 저장

### 2. Frontend: signInWithOAuth에 스코프 추가

- [x] signIn 호출 시 Drive/Calendar 스코프와 access_type/prompt 파라미터 포함
- [x] onAuthStateChange SIGNED_IN에서 provider_token 캡처하여 백엔드 전송
- [x] provider_token 전송 실패 시 console.error만 (fire-and-forget)

### 3. Frontend: API 클라이언트에 storeProviderTokens 메서드 추가

- [x] API.storeProviderTokens가 POST /auth/google/store-tokens 호출

### 4. Frontend: top-menu reconnect 로직 업데이트

- [x] Drive 미연결 시 signIn() 호출로 Supabase 재로그인
- [x] needsReauth 시 기존 /api/auth/google/authorize redirect 유지
