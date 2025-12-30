# 개발 환경 설정 가이드
<!-- Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-006 -->

> Worknote Management System 로컬 개발 환경을 설정하는 방법을 안내합니다.

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [초기 설정](#초기-설정)
3. [Cloudflare 리소스 생성](#cloudflare-리소스-생성)
4. [환경 변수 설정](#환경-변수-설정)
5. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
6. [개발 서버 실행](#개발-서버-실행)
7. [테스트 실행](#테스트-실행)
8. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 필수 소프트웨어

1. **Node.js**
   - 버전: ≥ 18.0.0
   - 권장: 20.x LTS
   - 설치 확인:
     ```bash
     node --version
     # v20.x.x
     ```

2. **npm**
   - 버전: ≥ 9.0.0
   - Node.js 설치 시 자동 포함
   - 설치 확인:
     ```bash
     npm --version
     # 10.x.x
     ```

3. **Git**
   - 버전: ≥ 2.30
   - 설치 확인:
     ```bash
     git --version
     # git version 2.x.x
     ```

### Cloudflare 계정

1. **Cloudflare 계정 생성**
   - https://dash.cloudflare.com/sign-up
   - 무료 플랜으로 시작 가능

2. **Wrangler CLI 설치**
   ```bash
   npm install -g wrangler
   # 또는
   npm install --save-dev wrangler
   ```

3. **Wrangler 로그인**
   ```bash
   wrangler login
   ```
   - 브라우저에서 Cloudflare 계정 인증

4. **Account ID 확인**
   - https://dash.cloudflare.com/?to=/:account/workers
   - URL 또는 우측 사이드바에서 Account ID 복사

### OpenAI API 키 (선택)

AI 기능을 사용하려면 OpenAI API 키가 필요합니다:
- https://platform.openai.com/api-keys
- GPT-4.5 및 text-embedding-3-small 사용 권한 필요

---

## 초기 설정

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/note-graph.git
cd note-graph
```

### 2. 의존성 설치

```bash
npm install
```

설치되는 주요 패키지:
- **Hono**: Cloudflare Workers용 웹 프레임워크
- **Zod**: 스키마 검증
- **nanoid**: ID 생성
- **date-fns**: 날짜 유틸리티
- **unpdf**: PDF 텍스트 추출
- **Jest**: 테스팅 프레임워크
- **Miniflare**: Workers 테스트 런타임

### 3. TypeScript 빌드 확인

```bash
npm run typecheck
```

---

## Cloudflare 리소스 생성

### 1. D1 데이터베이스

로컬 개발용과 프로덕션용 데이터베이스를 각각 생성합니다.

**로컬 개발용** (자동 생성됨):
```bash
# 로컬 D1 데이터베이스는 wrangler dev 실행 시 자동 생성
```

**프로덕션용**:
```bash
wrangler d1 create worknote-db
```

출력 예시:
```
✅ Successfully created DB 'worknote-db' in region APAC
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "DB"
database_name = "worknote-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

`database_id`를 복사하여 `wrangler.toml`에 입력합니다:
```toml
[[d1_databases]]
binding = "DB"
database_name = "worknote-db"
database_id = "YOUR_DATABASE_ID"  # 여기에 붙여넣기
```

### 2. Vectorize 인덱스

벡터 검색을 위한 Vectorize 인덱스를 생성합니다.

```bash
wrangler vectorize create worknote-vectors \
  --dimensions=1536 \
  --metric=cosine
```

출력 예시:
```
✅ Successfully created index 'worknote-vectors'
```

`wrangler.toml`에 설정 추가:
```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "worknote-vectors"
```

### 3. R2 버킷

파일 저장을 위한 R2 버킷을 2개 생성합니다.

**PDF 임시 저장용**:
```bash
wrangler r2 bucket create worknote-pdf-temp
```

**프로젝트 파일용**:
```bash
wrangler r2 bucket create worknote-files
```

`wrangler.toml`에 설정 추가:
```toml
[[r2_buckets]]
binding = "PDF_BUCKET"
bucket_name = "worknote-pdf-temp"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "worknote-files"
```

### 4. Queue

PDF 비동기 처리를 위한 Queue를 생성합니다.

```bash
wrangler queues create pdf-processing-queue
```

`wrangler.toml`에 설정 추가:
```toml
[[queues.producers]]
binding = "PDF_QUEUE"
queue = "pdf-processing-queue"

[[queues.consumers]]
queue = "pdf-processing-queue"
max_batch_size = 10
max_batch_timeout = 30
```

### 5. AI Gateway

OpenAI API 호출을 위한 AI Gateway를 생성합니다.

1. Cloudflare 대시보드 접속
2. AI → AI Gateway 메뉴
3. "Create Gateway" 버튼 클릭
4. Gateway 이름 입력: `worknote-maker`
5. Provider 선택: OpenAI
6. 생성 완료

`wrangler.toml`에 설정 확인:
```toml
[vars]
AI_GATEWAY_ID = "worknote-maker"
```

---

## 환경 변수 설정

### 1. 로컬 환경 변수 (.dev.vars)

로컬 개발용 환경 변수 파일을 생성합니다.

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 파일 내용:
```bash
# Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id

# OpenAI API Key (AI 기능 사용 시 필수)
OPENAI_API_KEY=sk-your-openai-api-key

# AI Gateway Authorization (선택사항)
# CF_AIG_AUTHORIZATION=your-ai-gateway-token
```

**주의**: `.dev.vars` 파일은 Git에 커밋하지 마세요 (`.gitignore`에 포함됨)

### 2. 프로덕션 환경 변수

프로덕션 환경의 시크릿은 Wrangler CLI로 설정합니다:

```bash
# Cloudflare Account ID
wrangler secret put CLOUDFLARE_ACCOUNT_ID
# 프롬프트에 Account ID 입력

# OpenAI API Key
wrangler secret put OPENAI_API_KEY
# 프롬프트에 API 키 입력

# AI Gateway Authorization (선택사항)
wrangler secret put CF_AIG_AUTHORIZATION
# 프롬프트에 토큰 입력
```

---

## 데이터베이스 마이그레이션

### 로컬 마이그레이션

로컬 D1 데이터베이스에 마이그레이션을 적용합니다:

```bash
npm run db:migrate:local
```

출력 예시:
```
🌀 Mapping SQL input into an array of statements
🌀 Executing on local database worknote-db (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) from .wrangler/state/v3/d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
├ [#####] 39/39 migrations complete
```

### 프로덕션 마이그레이션

**주의**: 프로덕션 데이터베이스는 신중하게 마이그레이션하세요.

```bash
npm run db:migrate
```

또는:
```bash
wrangler d1 migrations apply worknote-db --remote
```

### 마이그레이션 파일 구조

```
migrations/
├── 0001_initial_schema.sql       # 초기 스키마
├── 0002_embedding_retry_queue.sql # 임베딩 재시도
├── 0003_add_task_categories.sql  # 작업 카테고리
├── ...
└── README.md                      # 마이그레이션 가이드
```

### 새 마이그레이션 생성

```bash
# migrations/ 디렉토리에 새 SQL 파일 생성
# 파일명 형식: NNNN_description.sql
# 예: 0017_add_new_feature.sql
```

---

## 개발 서버 실행

### 전체 스택 실행

백엔드(Workers)와 프론트엔드(Vite)를 동시에 실행합니다:

```bash
npm run dev
```

실행 결과:
- **Backend**: http://localhost:8787
- **Frontend**: http://localhost:5173

### 백엔드만 실행

```bash
npm run dev:backend
# 또는
wrangler dev
```

- **URL**: http://localhost:8787
- **API 엔드포인트**: http://localhost:8787/api/...
- **Health Check**: http://localhost:8787/health

### 프론트엔드만 실행

```bash
npm run dev:frontend
# 또는
cd apps/web && npm run dev
```

- **URL**: http://localhost:5173
- **프록시**: `/api`는 자동으로 백엔드로 프록시

### 개발 시 인증

로컬 개발 환경에서는 Cloudflare Access 없이 테스트할 수 있습니다:

**방법 1: 테스트 헤더 사용**
```bash
curl -H "X-Test-User-Email: test@example.com" \
  http://localhost:8787/api/me
```

**방법 2: 브라우저 확장**
- ModHeader 또는 Requestly 확장 설치
- `X-Test-User-Email` 헤더 추가
- 값: 원하는 이메일 (예: `admin@example.com`)

---

## 테스트 실행

### 모든 테스트 실행

```bash
npm test
```

### 특정 테스트 파일 실행

```bash
npm test -- tests/jest/unit/chunking.test.ts
```

### 특정 테스트 패턴 실행

```bash
npm test -- --testNamePattern "WorkNote"
```

### 커버리지 포함 테스트

```bash
npm run test:coverage
```

### 테스트 디버깅 (상세 출력)

```bash
npm test -- --verbose
```

### 테스트 파일 구조

```
tests/
├── jest/                  # Jest 테스트
│   ├── unit/              # 단위 테스트
│   ├── integration/       # 통합 테스트
│   └── setup-verification.test.ts
├── jest-setup.ts          # Miniflare 설정 + 마이그레이션
└── README.md
```

---

## 프론트엔드 개발

### 프론트엔드 빌드

```bash
npm run build:frontend
```

빌드 결과:
- **출력 디렉토리**: `dist/web/`
- **Static Assets**: HTML, CSS, JS
- **Vite 번들**: 최적화된 프로덕션 빌드

### 프론트엔드 타입 체크

```bash
cd apps/web && npm run typecheck
```

### 프론트엔드 린트

```bash
cd apps/web && npm run lint
```

### 프론트엔드 구조

```
apps/web/
├── src/
│   ├── components/       # 재사용 가능한 UI 컴포넌트
│   ├── pages/            # 페이지 컴포넌트
│   ├── hooks/            # React 커스텀 훅
│   ├── lib/              # 유틸리티 및 API 클라이언트
│   ├── types/            # TypeScript 타입
│   └── App.tsx           # 메인 앱 컴포넌트
├── public/               # 정적 파일
├── vite.config.ts        # Vite 설정
└── tsconfig.json         # TypeScript 설정
```

---

## 코드 품질

### Linting

ESLint로 코드 스타일 검사:

```bash
npm run lint
```

자동 수정:
```bash
npm run lint:fix
```

### Type Checking

TypeScript 타입 체크:

```bash
npm run typecheck
```

백엔드와 프론트엔드 모두 포함:
```bash
npm run typecheck:all
```

### 코드 포맷팅

Prettier로 코드 포맷팅 (lint-staged로 자동 실행):

```bash
npm run format
```

---

## 유용한 명령어

### Wrangler 명령어

```bash
# Workers 로그 확인
wrangler tail

# D1 쿼리 실행
wrangler d1 execute worknote-db --command="SELECT * FROM persons"

# D1 백업
wrangler d1 export worknote-db --output=backup.sql

# Vectorize 인덱스 정보
wrangler vectorize get worknote-vectors

# R2 버킷 목록
wrangler r2 bucket list

# Queue 목록
wrangler queues list
```

### 데이터베이스 관리

```bash
# 로컬 D1 쿼리
npm run db:query:local "SELECT COUNT(*) FROM work_notes"

# 프로덕션 D1 쿼리
npm run db:query "SELECT COUNT(*) FROM work_notes"

# 마이그레이션 상태 확인
wrangler d1 migrations list worknote-db --local
```

---

## 문제 해결

### 1. Wrangler 로그인 실패

**문제**: `wrangler login` 실패
**해결**:
```bash
# 기존 세션 제거
wrangler logout
# 재로그인
wrangler login
```

### 2. D1 마이그레이션 오류

**문제**: 마이그레이션 실패 또는 중복 실행
**해결**:
```bash
# 로컬 D1 상태 초기화
rm -rf .wrangler/state/v3/d1
# 마이그레이션 재실행
npm run db:migrate:local
```

### 3. 포트 충돌

**문제**: 8787 또는 5173 포트가 이미 사용 중
**해결**:
```bash
# 포트 사용 프로세스 확인
lsof -i :8787
lsof -i :5173
# 프로세스 종료
kill -9 <PID>
```

또는 `wrangler.toml`에서 포트 변경:
```toml
[dev]
port = 8788
```

### 4. 의존성 설치 오류

**문제**: `npm install` 실패
**해결**:
```bash
# node_modules 및 lock 파일 삭제
rm -rf node_modules package-lock.json
# 캐시 정리
npm cache clean --force
# 재설치
npm install
```

### 5. TypeScript 오류

**문제**: 타입 체크 오류
**해결**:
```bash
# node_modules/@types 재설치
rm -rf node_modules/@types
npm install
# 전체 빌드
npm run build
```

### 6. Vectorize 연결 실패

**문제**: Vectorize 인덱스를 찾을 수 없음
**해결**:
1. 인덱스 존재 확인:
   ```bash
   wrangler vectorize get worknote-vectors
   ```
2. `wrangler.toml` 설정 확인
3. Account ID 및 권한 확인

### 7. AI Gateway 오류

**문제**: AI 호출 실패 (429, 401 등)
**해결**:
1. OpenAI API 키 확인:
   ```bash
   wrangler secret list
   ```
2. AI Gateway ID 확인 (`wrangler.toml`)
3. OpenAI API 크레딧 확인
4. Rate Limit 설정 확인

### 8. R2 업로드 실패

**문제**: 파일 업로드 시 오류
**해결**:
1. R2 버킷 존재 확인:
   ```bash
   wrangler r2 bucket list
   ```
2. 권한 확인
3. 파일 크기 제한 확인 (10MB/50MB)
4. CORS 설정 확인 (필요 시)

---

## 다음 단계

개발 환경 설정이 완료되었습니다! 이제 다음을 진행하세요:

1. **아키텍처 문서 읽기**: `docs/ARCHITECTURE.md`
2. **API 문서 확인**: `docs/API.md`
3. **배포 가이드 확인**: `docs/DEPLOYMENT.md`
4. **코딩 스타일 가이드 확인**: `.governance/coding-style.md`

---

## 참고 자료

- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [D1 데이터베이스 문서](https://developers.cloudflare.com/d1/)
- [Vectorize 문서](https://developers.cloudflare.com/vectorize/)
- [R2 스토리지 문서](https://developers.cloudflare.com/r2/)
- [Cloudflare Queues 문서](https://developers.cloudflare.com/queues/)
- [Hono 프레임워크 문서](https://hono.dev/)
- [Jest 문서](https://jestjs.io/)

---

**마지막 업데이트**: 2025-12-01
