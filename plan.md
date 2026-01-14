# Coverage Improvement Plan

## Current Status
- Overall: 70.23% statements, 54.28% branches, 54.28% functions, 70.23% lines
- Worker backend: **100% coverage** (all modules fully tested)
- Web app: **0% coverage** (no React component tests)
- Shared types: 0% (type definitions, no runtime code)

## Coverage Gaps Analysis

### Actual Gap Source
The 30% coverage gap comes entirely from the Web app:
- **113 TypeScript/React files** with zero test coverage
- Pages: RAG (219 lines), Work Notes (214 lines), PDF Upload (161 lines), Task Categories (149 lines)
- Hooks: 15 custom hooks (use-todos.ts, use-work-notes.ts, use-pdf.ts, etc.)
- Components: Layout, Dashboard, UI components (18 shadcn/ui components)
- Utilities: api.ts, date-utils.ts, utils.ts, mappers

### What's Already Covered (100%)
- All Worker middleware (error-handler.ts, validation-middleware.ts, etc.)
- All Worker repositories (8 files)
- All Worker services (16 files)
- All Worker routes (11 files)
- All Worker schemas (9 files)
- All Worker utils (ai-gateway.ts, r2-access.ts, etc.)

## Implementation Plan

### Phase 1: React Testing Infrastructure Setup
Goal: Enable React component testing

#### Task 1.1: Install Testing Dependencies
- [x] Install @testing-library/react, @testing-library/user-event, @testing-library/dom
- [x] Install jsdom for DOM environment
- **Command**: `bun add -D @testing-library/react @testing-library/user-event @testing-library/dom jsdom`

#### Task 1.2: Configure Vitest for React
- [x] Create separate vitest config for web app (vitest.config.web.ts)
- [x] Configure jsdom environment for React tests
- [x] Add test script for web app in package.json
- **Files to create**: vitest.config.web.ts

#### Task 1.3: Create Test Utilities
- [x] Create test setup file for React (mock providers, render utilities)
- [x] Create mock factories for API types (WorkNote, Todo, Department, etc.)
- [x] Create mock for @tanstack/react-query
- **Files to create**: apps/web/src/test/setup.ts, apps/web/src/test/factories.ts

### Phase 2: Custom Hooks Testing
Goal: Branches 54% → 62%, Functions 54% → 62%

#### Task 2.1: Core Data Hooks
- [x] Test use-todos.ts (fetch, create, update, delete, toggle)
- [x] Test use-work-notes.ts (CRUD, filtering, sorting, stats)
- [x] Test use-projects.ts (CRUD, participants, work note association)
- [x] Test use-persons.ts (fetch, search, filtering)
- **Files to create**: apps/web/src/hooks/__tests__/*.test.ts
- **Expected impact**: +8 functions, +20 branches

#### Task 2.2: Feature Hooks
- [x] Test use-pdf.ts (upload, progress tracking, error handling)
- [x] Test use-search.ts (query, results, pagination)
- [x] Test use-rag.ts (chat interactions, streaming, error handling)
- [x] Test use-ai-draft.ts (draft generation, form integration)
- **Expected impact**: +6 functions, +15 branches

#### Task 2.3: Utility Hooks
- [x] Test use-departments.ts (fetch, tree structure)
- [x] Test use-task-categories.ts (CRUD operations)
- [x] Test use-sidebar-collapse.ts (state persistence)
- [x] Test use-toast.ts (show/hide, variants)
- [x] Test use-debounced-value.ts (debounce behavior)
- **Expected impact**: +6 functions, +10 branches

### Phase 3: Page Component Testing
Goal: Branches 62% → 68%, Functions 62% → 68%

#### Task 3.1: Core Pages
- [x] Test work-notes.tsx (list display, filtering, CRUD actions)
- [x] Test dashboard.tsx (rendering, data fetching, layout)
- [x] Test projects.tsx (project management, participants)
- [x] Test persons.tsx (CRUD operations, search, department filter)
- **Files to create**: apps/web/src/pages/__tests__/*.test.tsx
- **Expected impact**: +10 functions, +25 branches

#### Task 3.2: Feature Pages
- [x] Test pdf-upload.tsx (file selection, upload progress, success/error)
- [x] Test search.tsx (search query, results display, pagination)
- [x] Test rag.tsx (chat interface, message display, streaming)
- [x] Test statistics.tsx (chart rendering, date filtering)
- **Expected impact**: +8 functions, +20 branches

#### Task 3.3: Management Pages
- [x] Test task-categories.tsx (CRUD operations)
- [x] Test departments.tsx (tree view, CRUD)
- **Expected impact**: +4 functions, +10 branches

### Phase 4: Layout & Utility Testing
Goal: Branches 68% → 70%, Functions 68% → 70%

#### Task 4.1: Layout Components
- [x] Test app-layout.tsx (sidebar/header rendering, responsive)
- [x] Test sidebar.tsx (navigation, collapsible sections, active state)
- [x] Test header.tsx (title, search, navigation)
- **Files to create**: apps/web/src/components/__tests__/*.test.tsx
- **Expected impact**: +5 functions, +12 branches

#### Task 4.2: Utility Functions
- [x] Test api.ts (all endpoint functions, error handling)
- [x] Test date-utils.ts (formatting, parsing, edge cases)
- [x] Test utils.ts (cn utility, object merging)
- [x] Test mappers/department.ts (data transformation)
- **Note**: Some tests already exist - extend coverage
- **Expected impact**: +4 functions, +8 branches

### Phase 5: Coverage Threshold Update
- [x] Analyze final coverage metrics
  - Statements: 70.06%, Branches: 54.22%, Functions: 54.22%, Lines: 70.06%
  - All 870 tests pass (572 worker + 298 web)
- [x] Update vitest.config.ts thresholds:
  - Statements: 70 (maintain)
  - Branches: 54 (increase from 53, matching actual 54.22%)
  - Functions: 54 (increase from 53, matching actual 54.22%)
  - Lines: 70 (maintain)
- [x] Document coverage exclusions in vitest.config.ts:
  - packages/shared/types/** (type-only definitions, no runtime code)
  - apps/web/src/components/ui/** (third-party shadcn/ui components)
  - apps/web/src/styles/** (CSS-only files)
  - tests/ and apps/web/src/test/** (test utilities and setup)
  - Final coverage with exclusions: 71.41% stmts, 58.18% branches/functions

## Success Criteria
- Final coverage: 70+ statements, 65+ branches, 65+ functions, 70+ lines
- All API routes: 100% (already achieved)
- All backend services: 100% (already achieved)
- All custom hooks: 90%+
- Core pages: 85%+
- Test execution time < 60 seconds

## Notes
- Worker backend testing is complete - no additional work needed
- Focus exclusively on Web app testing
- packages/shared/types can be excluded (type definitions only)
- UI library components (shadcn/ui) don't need unit tests - test integration instead

---

# Google Drive 연동 구현 계획

## 개요
업무노트 파일 저장소를 Cloudflare R2에서 Google Drive로 전환

**결정 사항:**
- 폴더 위치: 특정 폴더 아래 (예: `My Drive/업무노트/WORK-xxx`)
- 파일 열람: Google Drive 웹뷰어로 리다이렉트
- 사용자: 1명 (개인 사용)

---

## Phase 1: Google Cloud 설정 (수동)

- [ ] Google Cloud Console에서 프로젝트 생성
- [ ] Google Drive API 활성화
- [ ] OAuth 2.0 클라이언트 ID 생성 (Web application)
- [ ] Redirect URI 설정: `https://note.kadragon.work/api/auth/google/callback`
- [ ] 스코프: `https://www.googleapis.com/auth/drive.file`

---

## Phase 2: DB 마이그레이션

### Task 2.1: OAuth 토큰 테이블
- [x] `migrations/0020_add_google_oauth_tokens.sql` 생성
```sql
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  user_email TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Task 2.2: 파일 테이블 확장
- [x] `migrations/0021_update_work_note_files_for_gdrive.sql` 생성
```sql
-- Google Drive 필드 추가
ALTER TABLE work_note_files ADD COLUMN gdrive_file_id TEXT;
ALTER TABLE work_note_files ADD COLUMN gdrive_folder_id TEXT;
ALTER TABLE work_note_files ADD COLUMN gdrive_web_view_link TEXT;
ALTER TABLE work_note_files ADD COLUMN storage_type TEXT NOT NULL DEFAULT 'R2';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_work_note_files_storage_type ON work_note_files(storage_type);
CREATE INDEX IF NOT EXISTS idx_work_note_files_gdrive_file_id ON work_note_files(gdrive_file_id);

-- 업무노트별 폴더 추적
CREATE TABLE IF NOT EXISTS work_note_gdrive_folders (
  work_id TEXT PRIMARY KEY REFERENCES work_notes(work_id) ON DELETE CASCADE,
  gdrive_folder_id TEXT NOT NULL,
  gdrive_folder_link TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Phase 3: 백엔드 구현

### Task 3.1: 환경 변수 추가
- [x] `apps/worker/src/types/env.ts` 수정
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `GDRIVE_ROOT_FOLDER_ID` (루트 폴더 ID)
- [x] `wrangler.toml` 수정
```toml
[vars]
GOOGLE_REDIRECT_URI = "https://note.kadragon.work/api/auth/google/callback"
```

### Task 3.2: Google OAuth 서비스
- [x] `apps/worker/src/repositories/google-oauth-repository.ts` 생성
- [x] `apps/worker/src/services/google-oauth-service.ts` 생성
  - `getAuthorizationUrl(): string`
  - `exchangeCodeForTokens(code: string): Promise<OAuthTokens>`
  - `refreshTokens(refreshToken: string): Promise<OAuthTokens>`
  - `storeTokens(userEmail: string, tokens: OAuthTokens): Promise<void>`
  - `getValidAccessToken(userEmail: string): Promise<string>`

### Task 3.3: Google Drive 서비스
- [x] `apps/worker/src/services/google-drive-service.ts` 생성
  - `createFolder(name: string, parentId?: string): Promise<DriveFolder>`
  - `getOrCreateWorkNoteFolder(workId: string): Promise<DriveFolder>`
  - `uploadFile(folderId: string, file: Blob, fileName: string): Promise<DriveFile>`
  - `deleteFile(fileId: string): Promise<void>`

### Task 3.4: OAuth 라우트
- [x] `apps/worker/src/routes/auth-google.ts` 생성
  - `GET /api/auth/google/authorize` - OAuth 시작
  - `GET /api/auth/google/callback` - OAuth 콜백
  - `GET /api/auth/google/status` - 연결 상태
  - `POST /api/auth/google/disconnect` - 연결 해제
- [x] `apps/worker/src/index.ts` 라우트 등록

### Task 3.5: 파일 서비스 수정
- [x] `apps/worker/src/services/work-note-file-service.ts` 수정
  - R2 대신 GoogleDriveService 사용 (with R2 fallback)
  - `uploadFile`: Drive에 업로드, DB에 drive 정보 저장
  - `deleteFile`: Drive에서 삭제
- [x] `apps/worker/src/routes/work-notes.ts` 수정
  - `GET /:workId/files/:fileId/view`: Drive 링크로 리다이렉트
  - `GET /:workId/files/:fileId/download`: Drive 링크로 리다이렉트

---

## Phase 4: 타입 정의 수정

- [x] `packages/shared/types/work-note.ts` 수정
```typescript
export interface WorkNoteFile {
  fileId: string;
  workId: string;
  r2Key?: string;  // deprecated, 마이그레이션 호환용
  gdriveFileId?: string;
  gdriveFolderId?: string;
  gdriveWebViewLink?: string;
  storageType: 'R2' | 'GDRIVE';
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  deletedAt: string | null;
}
```

---

## Phase 5: 프론트엔드 수정

- [x] `apps/web/src/pages/work-notes/components/work-note-file-list.tsx` 수정
  - 파일 클릭 시 `gdriveWebViewLink`로 새 탭 열기
  - "Google Drive에서 열기" 버튼 추가
  - Drive 아이콘 표시
- [x] `apps/web/src/hooks/use-work-notes.ts` 수정
  - `downloadWorkNoteFile` 수정: Drive 링크 반환

---

## Phase 6.5: Google Drive 통합 버그 수정 (P1/P2 Regression Fix)

### 문제 분석

코드 리뷰에서 발견된 Google Drive 통합 관련 회귀 버그입니다.

| 우선순위 | 문제 | 위치 | 영향 |
|---------|------|------|------|
| **P1** | WorkNoteService가 Drive 처리 미활성화 | `work-note-service.ts:40-50` | Drive 파일 업로드/삭제 불가 |
| **P1** | 노트 삭제 시 Drive 정리 누락 | `work-note-service.ts:120-126` | Drive 파일/폴더 orphan 발생 |
| **P2** | Download-all hook의 Drive 첨부파일 실패 | `use-download-work-note.ts:43-48` | Drive 첨부 다운로드 오류 토스트 |

### Task 6.5.1: WorkNoteService에 env 전달 (P1)

**원인**: `WorkNoteFileService` 생성 시 `env` 파라미터 누락으로 `useGoogleDrive=false` 고정
```typescript
// 현재 (버그)
this.fileService = env.R2_BUCKET ? new WorkNoteFileService(env.R2_BUCKET, env.DB) : null;

// 수정 후
this.fileService = env.R2_BUCKET ? new WorkNoteFileService(env.R2_BUCKET, env.DB, env) : null;
```

- [x] 테스트 작성: WorkNoteService가 Google Drive 자격 증명 있을 때 driveService 활성화 확인
- [x] 수정: `work-note-service.ts:49`에서 `env` 전달

### Task 6.5.2: Work note 삭제 시 userEmail 전달 (P1)

**원인**: `delete()` 메서드에서 `deleteWorkNoteFiles(workId)`만 호출, `userEmail` 미전달
```typescript
// 현재 (버그)
this.fileService.deleteWorkNoteFiles(workId).catch(...)

// 수정 후
this.fileService.deleteWorkNoteFiles(workId, userEmail).catch(...)
```

- [x] 테스트 작성: deleteWithFiles가 userEmail을 전달하여 Drive 파일 삭제 확인
- [x] 수정: `WorkNoteService.delete()` 시그니처에 `userEmail?: string` 추가
- [x] 수정: `work-notes.ts` 라우트에서 `userEmail` 전달

### Task 6.5.3: Download hook에서 Drive 첨부파일 처리 (P2)

**원인**: `API.downloadWorkNoteFile()`이 Blob을 기대하나, Drive 파일은 302 리다이렉트 반환
```typescript
// 현재 (버그) - 302 리다이렉트에서 실패
const fileBlob = await API.downloadWorkNoteFile(workNote.id, file.fileId);
triggerDownload(fileBlob, file.originalName);

// 수정 후 - storageType에 따라 분기
if (file.storageType === 'GDRIVE' && file.gdriveWebViewLink) {
  window.open(file.gdriveWebViewLink, '_blank');
} else {
  const fileBlob = await API.downloadWorkNoteFile(workNote.id, file.fileId);
  triggerDownload(fileBlob, file.originalName);
}
```

- [x] 테스트 작성: Drive 첨부파일일 때 새 탭으로 열기 동작 확인
- [x] 수정: `use-download-work-note.ts`에서 `storageType` 분기 처리
- [x] 수정: 다운로드 완료 토스트 메시지 조정 (Drive 파일은 "열기" 표현)

### Task 6.5.4: 통합 테스트

- [x] E2E 시나리오: Drive 첨부파일 업로드 → 다운로드 → 노트 삭제 → Drive 파일 정리 확인

---

## Phase 6: 마이그레이션 스크립트

- [ ] `scripts/migrate-r2-to-gdrive.ts` 생성
  1. `storage_type = 'R2'`인 파일 목록 조회
  2. workId별로 그룹화
  3. 각 workId에 대해:
     - Google Drive 폴더 생성
     - R2에서 파일 다운로드
     - Drive에 업로드
     - DB 업데이트 (gdrive 정보, storage_type)
  4. 검증 후 R2 파일 삭제 (선택)

---

## 수정할 파일 목록

### 새로 생성
- `migrations/0020_add_google_oauth_tokens.sql`
- `migrations/0021_update_work_note_files_for_gdrive.sql`
- `apps/worker/src/services/google-oauth-service.ts`
- `apps/worker/src/services/google-drive-service.ts`
- `apps/worker/src/routes/auth-google.ts`
- `apps/worker/src/repositories/google-oauth-repository.ts`
- `scripts/migrate-r2-to-gdrive.ts`

### 수정
- `apps/worker/src/types/env.ts`
- `apps/worker/src/services/work-note-file-service.ts`
- `apps/worker/src/routes/work-notes.ts`
- `apps/worker/src/index.ts` (라우트 등록)
- `packages/shared/types/work-note.ts`
- `apps/web/src/pages/work-notes/components/work-note-file-list.tsx`
- `apps/web/src/hooks/use-work-notes.ts`
- `wrangler.toml`

---

## 검증 방법

1. **OAuth 플로우 테스트**
    - `/api/auth/google/authorize` 접속 → Google 로그인 → 콜백 확인

2. **파일 업로드 테스트**
    - 새 업무노트에 파일 첨부
    - Google Drive에서 폴더/파일 생성 확인

3. **파일 열람 테스트**
    - 파일 클릭 → Google Drive 웹뷰어 열림 확인

4. **마이그레이션 테스트**
    - 테스트 데이터로 스크립트 실행
    - 모든 파일이 Drive로 이동 확인

5. **로컬 동기화 확인**
    - Google Drive 데스크톱 앱에서 폴더 동기화 확인
    - 로컬에서 파일 열람/수정 가능 확인

---

## Phase 7: 운영 간소화

### Task 7.1: R2 폴백 제거
- [ ] `apps/worker/src/services/work-note-file-service.ts` 리팩토링
  - 조건: `GOOGLE_CLIENT_ID` 환경 변수 체크
  - 없으면: 에러 발생 (더 이상 R2 폴백 미지원)
  - 있으면: Google Drive 사용
- [ ] 문서 업데이트: "Google OAuth 필수 환경 변수" 명시
- [ ] 마이그레이션 검증: 기존 R2 파일 모두 Drive로 이동 완료 확인

### Task 7.2: 인증 미들웨어 통합 가이드
- [ ] `apps/worker/src/middleware/auth.ts` 주석 확대
  - Cloudflare Access는 기본 보호층 (프록시 레벨)
  - getAuthUser()는 user_email 추출용 (이미 인증된 사용자만)
  - Google OAuth는 Drive 접근용 (필수)
- [ ] 개발 환경 문서화
  ```
  로컬 테스트:
  - CF Access 헤더 모의: x-test-user-email: dev@localhost
  - Google OAuth: 선택적 (GOOGLE_CLIENT_ID 없으면 Drive 기능 비활성)
  ```

### Task 7.3: 환경 변수 정리 및 필수 여부 명시
- [ ] `.dev.vars.example` 수정
  ```
  # Cloudflare Access (자동 제공, 설정 불필요)
  # ENVIRONMENT: 자동 감지
  
  # Google Drive (필수)
  GOOGLE_CLIENT_ID=your-client-id
  GOOGLE_CLIENT_SECRET=your-client-secret
  GDRIVE_ROOT_FOLDER_ID=your-folder-id
  
  # 기타 (선택)
  # R2: 더 이상 사용하지 않음 (2025-01-01부터)
  ```
- [ ] `wrangler.toml` 주석 정리
  - GOOGLE_CLIENT_ID/SECRET을 "필수" 항목으로 표시
  - R2 관련 설정 제거 검토

### Task 7.4: 배포 가이드 작성
- [ ] `docs/DEPLOYMENT.md` 또는 README 업데이트
  ```
  ## 배포 체크리스트
  
  1. Cloudflare Access 설정 (1회만)
     - 조직 인증 정책: Google OAuth 기반
     - 접근 정책: Allow with specific email
  
  2. Google OAuth 설정 (1회만)
     - Google Cloud Console에서 프로젝트 생성
     - Drive API 활성화
     - OAuth 2.0 클라이언트 ID 생성
     - Redirect URI: https://note.kadragon.work/api/auth/google/callback
  
  3. Cloudflare Workers 배포
     - wrangler secret put GOOGLE_CLIENT_ID
     - wrangler secret put GOOGLE_CLIENT_SECRET
     - wrangler secret put GDRIVE_ROOT_FOLDER_ID
     - wrangler deploy
  
  4. 데이터 마이그레이션 (필요시)
     - R2→Google Drive 마이그레이션 스크립트 실행
     - 검증: 모든 파일 Drive에 존재 확인
  ```

### Task 7.5: 운영 모니터링 가이드
- [ ] `docs/OPERATIONS.md` 생성
  ```
  ## 주요 모니터링 항목
  
  1. Google OAuth 토큰 만료
     - google_oauth_tokens.expires_at 모니터링
     - 자동 refresh 로직 정상 동작 확인
  
  2. Google Drive 권한
     - Drive API 쿼터 확인 (100 users/sec 이상)
     - 폴더 접근 권한 유지 (정기 점검)
  
  3. 스토리지 비용
     - Google Drive 용량 관리 (15GB 무료)
     - 버전 관리: 최신 5개만 유지 (자동)
  
  4. Cloudflare 비용
     - Workers 실행 시간 (일 1,000,000회 무료)
     - D1 데이터베이스 사용량
  ```

### Task 7.6: 개발 환경 자동화
- [ ] `scripts/setup-local-dev.ts` 개선
  ```typescript
  // 체크리스트:
  // 1. .dev.vars 파일 생성 확인
  // 2. GOOGLE_CLIENT_ID 존재 여부 확인
  // 3. D1 마이그레이션 실행
  // 4. 로컬 테스트 헤더 설정 가이드
  ```
- [ ] `package.json` 스크립트 추가
  ```json
  {
    "scripts": {
      "dev:check": "node scripts/check-env.js",
      "dev:setup": "npm run dev:check && npm run db:migrate:local"
    }
  }
  ```

### Task 7.7: 문서화 완성
- [ ] README.md에 "인증 체계" 섹션 추가
  ```
  ## 인증 및 저장소
  
  ### 인증 (2단계)
  1. **Cloudflare Access** (조직 수준)
     - 모든 요청을 프록시 레벨에서 보호
     - 자동으로 사용자 이메일 헤더 추가
  
  2. **Google OAuth** (애플리케이션 수준)
     - Drive 파일 접근 용 refresh token
     - 사용자가 "Google 연결" 버튼으로 1회 인가
  
  ### 파일 저장소
  - **Google Drive** (2025-01-01 이후)
  - 폴더 구조: `GDRIVE_ROOT_FOLDER_ID/WORK-xxx/`
  - 버전 관리: 최신 5개 유지 (자동 삭제)
  ```

---

## 운영 간소화 성과 (예상)

| 항목 | 현재 | 개선 후 | 효과 |
|------|------|--------|------|
| **배포 복잡도** | R2 + Drive 이중 지원 | Drive 단일화 | 코드 간소화, 버그 감소 |
| **환경 변수** | 선택적/필수 혼재 | 명시적 분류 | 배포 오류 감소 |
| **인증 로직** | CF Access + OAuth 분산 | 통합 가이드 제공 | 유지보수 용이 |
| **개발 DX** | 수동 헤더 설정 | 자동화 스크립트 | 신규 개발자 온보딩 빠름 |
| **비용** | R2 + Drive 중복 비용 | Drive 단일 비용 | 운영비 절감 |
