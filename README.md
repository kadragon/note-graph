# Note Graph - 업무노트 관리 시스템

Personal work note management system with AI-powered features, built on Cloudflare Workers.

## Overview

업무노트 관리 시스템은 개인 사용자(1인)가 업무를 구조화된 노트, To-do, 사람/부서 컨텍스트 및 AI를 활용하여 관리할 수 있는 시스템입니다.

### Key Features

- **Work Notes**: 업무 기록 생성, 버전 관리 (최근 5개 보관)
- **People & Departments**: 조직 구성원 및 부서 관리, 부서 이력 추적
- **Todo Management**: 반복 업무 지원, 대기일 설정, 기한 관리
- **Hybrid Search**: FTS5(lexical) + Vectorize(semantic) 하이브리드 검색
- **RAG (Retrieval-Augmented Generation)**: 업무 기반 맥락적 질의응답
- **AI Draft Generation**: 텍스트 및 PDF 기반 자동 업무노트 초안 생성
- **PDF Processing**: 비동기 PDF 텍스트 추출 및 업무 생성

### Architecture

- **Platform**: Cloudflare Workers (서버리스)
- **Database**: Cloudflare D1 (SQLite)
- **Vector Search**: Cloudflare Vectorize
- **AI**: OpenAI GPT-4.5 + text-embedding-3-small via AI Gateway
- **Auth**: Cloudflare Access (Google OAuth)
- **Async Processing**: Cloudflare Queues
- **Storage**: Cloudflare R2 (임시 PDF 저장)

## Project Structure

```
note-graph/
├── AGENTS.md             # Consolidated governance, specs, task history
├── apps/
│   ├── worker/           # Cloudflare Worker backend (Hono API, services, utils)
│   └── web/              # React SPA (Vite, Tailwind, shadcn/ui)
│
├── packages/
│   └── shared/           # Cross-app TypeScript types
│
├── migrations/           # D1 database migrations
├── tests/                # Test files (unit + integration)
├── dist/                 # Build output (worker bundle, web assets under dist/web)
└── wrangler.toml         # Cloudflare Workers config
```

## Development Workflow (TDD)

이 프로젝트는 **Test-Driven Development (TDD)** 를 기준으로 개발합니다.

### Workflow

1. **Create/Update Tests** (RED)
2. **Implement Code** (GREEN)
3. **Refactor** (유지)
4. **Record Progress** (`AGENTS.md` 업데이트)

### Development Phases

#### Phase 1: Infrastructure & Core (11h)

- Wrangler 프로젝트 초기화
- D1 스키마 및 마이그레이션
- 인증 미들웨어
- Hono API 구조

#### Phase 2: Entity Management (19h)

- Person CRUD
- Department CRUD
- Work Note CRUD with versioning
- Todo CRUD with recurrence

#### Phase 3: Search & AI (25h)

- FTS 렉시컬 검색
- Vectorize 설정 및 임베딩
- 하이브리드 검색 (RRF)
- RAG 구현
- AI 초안 생성

#### Phase 4: PDF Processing (10h)

- PDF 업로드 및 R2 저장
- 큐 기반 비동기 처리
- unpdf 텍스트 추출

#### Phase 5: Testing & Polish (32h)

- 테스트 스위트 작성
- 프론트엔드 UI 구축

#### Phase 6: Deployment & Docs (10h)

- Cloudflare Access 설정
- 프로덕션 배포
- 문서화

**Total Estimated Effort**: 107 hours

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.2.20
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Install dependencies
bun install

# Create D1 database
wrangler d1 create worknote-db

# Create Vectorize index
wrangler vectorize create worknote-vectors --dimensions=1536 --metric=cosine

# Create R2 bucket
wrangler r2 bucket create worknote-pdf-temp

# Create Queue
wrangler queues create pdf-processing-queue

# Run migrations
bun run db:migrate:local

# Start development server
bun run dev
```

### Configuration

#### Development Environment

1. Copy `.dev.vars.example` to `.dev.vars`:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Update `.dev.vars` with your Cloudflare Account ID:

   ```bash
   # .dev.vars
   CLOUDFLARE_ACCOUNT_ID=your-actual-cloudflare-account-id
   ```

   Find your account ID at: <https://dash.cloudflare.com/?to=/:account/workers>

3. Update `wrangler.toml` with resource IDs:

   - Update `database_id` in `[[d1_databases]]` section
   - Update `AI_GATEWAY_ID` with your gateway name

4. Set up Cloudflare Access for Google OAuth

#### Production Environment

Set secrets using Wrangler CLI:

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put OPENAI_API_KEY
wrangler secret put CF_AIG_AUTHORIZATION  # Optional, if AI Gateway requires auth
```

## Testing

```bash
# Run tests
bun run test

# Run with coverage
bun run test:coverage
```

## Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

## 문서

### 사용자 가이드

- **[사용자 가이드](docs/USER_GUIDE.md)**: 시스템 사용 방법, 기능 설명 (한국어)

### 개발자 문서

- **[개발 환경 설정](docs/SETUP.md)**: 로컬 개발 환경 구축 가이드
- **[시스템 아키텍처](docs/ARCHITECTURE.md)**: 아키텍처, 설계 결정, 기술 스택
- **[API 문서](docs/API.md)**: 모든 API 엔드포인트 상세 설명
- **[배포 가이드](docs/DEPLOYMENT.md)**: Cloudflare Workers 배포 방법

### API 엔드포인트

- **Auth**: `GET /me`
- **Persons**: `GET|POST /persons`, `GET|PUT /persons/{personId}`
- **Departments**: `GET|POST /departments`, `GET|PUT /departments/{deptName}`
- **Work Notes**: `GET|POST /work-notes`, `GET|PUT|DELETE /work-notes/{workId}`
- **Todos**: `GET /todos`, `PATCH /todos/{todoId}`
- **Projects**: `GET|POST /projects`, `GET|PUT|DELETE /projects/{projectId}`
- **Search**: `POST /search/work-notes`
- **RAG**: `POST /rag/query`
- **AI Draft**: `POST /ai/work-notes/draft-from-text`
- **PDF**: `POST /pdf-jobs`, `GET /pdf-jobs/{jobId}`
- **Statistics**: `GET /statistics`

자세한 내용은 [API 문서](docs/API.md) 또는 `openapi.yaml` 파일을 참조하세요.

## Task Management

작업 이력과 운영 지식은 `AGENTS.md`에 요약합니다.

## Contributing

이 프로젝트는 개인용 시스템이므로 외부 기여는 받지 않습니다.

## License

Private - All rights reserved

## Traceability

모든 코드와 테스트는 spec_id와 task_id를 참조해야 합니다:

```typescript
// Trace: SPEC-worknote-1, TASK-007
export class WorkNoteRepository {
  // ...
}
```
