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
├── .governance/          # Project knowledge base
│   ├── memory.md         # Project history and decisions
│   ├── coding-style.md   # Coding conventions
│   ├── patterns.md       # Design patterns
│   └── env.yaml          # Environment config
│
├── .spec/                # Feature specifications (GWT format)
│   ├── auth/
│   ├── person-management/
│   ├── department-management/
│   ├── worknote-management/
│   ├── todo-management/
│   ├── search/
│   ├── rag/
│   ├── ai-draft/
│   └── pdf-processing/
│
├── .tasks/               # Task management
│   ├── backlog.yaml      # Pending tasks
│   ├── current.yaml      # Active task
│   └── done.yaml         # Completed tasks
│
├── src/                  # Source code
│   ├── index.ts          # Worker entry point
│   ├── types/            # TypeScript types
│   ├── models/           # Data models
│   ├── services/         # Business logic
│   ├── handlers/         # API handlers
│   ├── utils/            # Utilities
│   └── middleware/       # Request middleware
│
├── migrations/           # D1 database migrations
├── tests/                # Test files
└── wrangler.toml         # Cloudflare Workers config
```

## Development Workflow (SDD × TDD)

이 프로젝트는 **Spec-Driven Development (SDD)** 와 **Test-Driven Development (TDD)** 를 결합하여 개발합니다.

### Workflow

1. **Read SPEC** (.spec/ 디렉토리)
2. **Create/Update Tests** (RED)
3. **Implement Code** (GREEN)
4. **Refactor** (유지)
5. **Record Progress** (.tasks/ 업데이트)
6. **Update Governance** (.governance/memory.md 갱신)

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
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Install dependencies
npm install

# Create D1 database
wrangler d1 create worknote-db

# Create Vectorize index
wrangler vectorize create worknote-vectors --dimensions=1536 --metric=cosine

# Create R2 bucket
wrangler r2 bucket create worknote-pdf-temp

# Create Queue
wrangler queues create pdf-processing-queue

# Run migrations
npm run db:migrate:local

# Start development server
npm run dev
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
   Find your account ID at: https://dash.cloudflare.com/?to=/:account/workers

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
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Documentation

API는 OpenAPI 3.0.3 스펙으로 정의되어 있습니다. 자세한 내용은 프로젝트 루트의 `openapi.yaml` 파일을 참조하세요.

### Main Endpoints

- **Auth**: `GET /me`
- **Persons**: `GET|POST /persons`, `GET|PUT /persons/{personId}`
- **Departments**: `GET|POST /departments`, `GET|PUT /departments/{deptName}`
- **Work Notes**: `GET|POST /work-notes`, `GET|PUT|DELETE /work-notes/{workId}`
- **Todos**: `GET /todos`, `PATCH /todos/{todoId}`
- **Search**: `POST /search/work-notes`
- **RAG**: `POST /rag/query`
- **AI Draft**: `POST /ai/work-notes/draft-from-text`
- **PDF**: `POST /pdf-jobs`, `GET /pdf-jobs/{jobId}`

## Task Management

개발 작업은 `.tasks/` 디렉토리로 관리됩니다:

- **backlog.yaml**: 대기 중인 작업 (우선순위 정렬)
- **current.yaml**: 현재 진행 중인 작업 (한 번에 하나만)
- **done.yaml**: 완료된 작업 및 결과

새 작업을 시작하려면 `backlog.yaml`에서 `current.yaml`로 이동하세요.

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

---

**Generated with Autonomous Coding Agent (SDD × TDD)**
