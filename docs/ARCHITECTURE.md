# 시스템 아키텍처 문서
<!-- Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-006 -->

> Worknote Management System의 전체 아키텍처, 설계 결정, 기술 스택을 설명합니다.

## 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처 다이어그램](#아키텍처-다이어그램)
3. [기술 스택](#기술-스택)
4. [핵심 설계 결정](#핵심-설계-결정)
5. [데이터 모델](#데이터-모델)
6. [API 설계](#api-설계)
7. [검색 시스템](#검색-시스템)
8. [AI 통합](#ai-통합)
9. [비동기 처리](#비동기-처리)
10. [보안 및 인증](#보안-및-인증)
11. [성능 최적화](#성능-최적화)
12. [확장성 고려사항](#확장성-고려사항)

---

## 시스템 개요

### 목적

개인 사용자(1인)를 위한 업무 지식 기반 및 운영 시스템으로, 구조화된 노트, 할 일, 조직 정보 및 AI를 활용하여 업무를 효율적으로 관리합니다.

### 핵심 기능

1. **업무노트 관리**: 버전 관리, Markdown 지원, 관계 추적
2. **할 일 관리**: 반복 업무, 대기일, 기한 관리
3. **조직 관리**: 사람, 부서, 부서 이력 추적
4. **프로젝트 관리**: 파일 첨부, 팀 협업, 통계
5. **하이브리드 검색**: 렉시컬(FTS5) + 시맨틱(Vectorize) 검색
6. **RAG (검색 증강 생성)**: 업무 맥락 기반 AI 챗봇
7. **AI 초안 생성**: 텍스트 및 PDF에서 자동 업무노트 생성
8. **통계 및 분석**: 기간별 업무 완료 현황 분석

### 아키텍처 원칙

- **서버리스 우선(Serverless-First)**: 관리 오버헤드 최소화
- **엣지 컴퓨팅(Edge Computing)**: 전 세계 낮은 레이턴시
- **데이터 지역성(Data Locality)**: 모든 데이터를 Cloudflare 생태계 내에 유지
- **비용 효율성(Cost Efficiency)**: 종량제 요금, 무료 티어 활용
- **개발자 경험(Developer Experience)**: TypeScript, 타입 안전성, TDD

---

## 아키텍처 다이어그램

### 고수준 아키텍처

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────────────────────────────────┐
│      Cloudflare Access (Auth)           │
│        Google OAuth 2.0                  │
└─────────────────┬───────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ↓                     ↓
┌─────────────┐      ┌─────────────┐
│   Workers   │      │   Workers   │
│   (API)     │      │   (Queue)   │
└──────┬──────┘      └──────┬──────┘
       │                    │
       │  ┌─────────────────┘
       │  │
       ↓  ↓
┌──────────────────────────────────────────┐
│        Cloudflare Data Services          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │  D1  │  │Vector│  │  R2  │  │Queue │ │
│  └──────┘  └──────┘  └──────┘  └──────┘ │
└──────────────────────────────────────────┘
       │
       ↓
┌─────────────┐
│ AI Gateway  │
│   OpenAI    │
└─────────────┘
```

### 데이터 흐름

#### 1. 업무노트 생성 (AI 초안)

```
User Input (Text/PDF)
       ↓
  [Worker API]
       │
       ├──→ [R2] Store PDF
       │
       ├──→ [Queue] Send Job
       │
       └──→ [D1] Create Job Record

[Queue Consumer]
       │
       ├──→ [R2] Fetch PDF
       │
       ├──→ [unpdf] Extract Text
       │
       ├──→ [AI Gateway/OpenAI] Generate Draft
       │
       └──→ [D1] Update Job with Draft

User Reviews Draft
       ↓
  [Worker API]
       │
       ├──→ [D1] Insert Work Note + Version
       │
       ├──→ [Chunking Service] Split Text
       │
       └──→ [Vectorize] Store Embeddings
```

#### 2. 하이브리드 검색

```
Search Query
       ↓
  [Worker API]
       │
       ├──→ [D1 FTS5] Lexical Search
       │      (Trigram Tokenizer)
       │
       ├──→ [AI Gateway/OpenAI] Embed Query
       │
       ├──→ [Vectorize] Semantic Search
       │      (Cosine Similarity)
       │
       └──→ [RRF Algorithm] Merge Results
              (Reciprocal Rank Fusion)

Results → User
```

#### 3. RAG 챗봇

```
User Question
       ↓
  [Worker API]
       │
       ├──→ [AI Gateway/OpenAI] Embed Question
       │
       ├──→ [Vectorize] Find Similar Chunks
       │      (with Metadata Filters)
       │
       ├──→ [D1] Fetch Full Content
       │
       ├──→ [RAG Service] Build Context
       │
       └──→ [AI Gateway/OpenAI] GPT-4.5
              Generate Answer with Sources

Answer + Sources → User
```

---

## 기술 스택

### 인프라 (Cloudflare Platform)

| 컴포넌트 | 기술 | 용도 |
|---------|------|------|
| **Compute** | Cloudflare Workers | 서버리스 API, 비즈니스 로직 |
| **Database** | Cloudflare D1 (SQLite) | 관계형 데이터 저장, FTS5 검색 |
| **Vector DB** | Cloudflare Vectorize | 벡터 임베딩, 시맨틱 검색 |
| **Storage** | Cloudflare R2 | PDF 임시 저장, 프로젝트 파일 |
| **Queue** | Cloudflare Queues | 비동기 PDF 처리 |
| **Auth** | Cloudflare Access | Google OAuth 인증 |
| **CDN** | Cloudflare CDN | 정적 파일 서빙 (프론트엔드) |

### 백엔드

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| **Runtime** | Cloudflare Workers | V8 Isolates |
| **Framework** | Hono | 4.x |
| **Validation** | Zod | 3.x |
| **Language** | TypeScript | 5.x |
| **ID Generation** | nanoid | 5.x |
| **Date Utils** | date-fns | 4.x |
| **PDF Parsing** | unpdf | 1.x |

### 프론트엔드

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| **Framework** | React | 18.x |
| **Build Tool** | Vite | 7.x |
| **State Management** | TanStack Query (React Query) | 5.x |
| **Routing** | TanStack Router | 2.x |
| **UI Components** | shadcn/ui (Radix UI) | - |
| **Styling** | Tailwind CSS | 4.x |
| **Charts** | Recharts | 2.x |
| **Markdown** | react-markdown | 9.x |
| **Icons** | Lucide React | 0.x |
| **Command Palette** | cmdk | 1.x |

### AI

| 컴포넌트 | 기술 | 모델 |
|---------|------|------|
| **LLM** | OpenAI via AI Gateway | GPT-4.5 |
| **Embeddings** | OpenAI via AI Gateway | text-embedding-3-small (1536 dim) |
| **Gateway** | Cloudflare AI Gateway | Rate limiting, caching, logging |

### 테스팅

| 컴포넌트 | 기술 | 용도 |
|---------|------|------|
| **Test Framework** | Jest | 단위/통합 테스트 |
| **Test Runtime** | Miniflare | Workers 환경 테스트 |
| **Coverage** | Jest coverage | 코드 커버리지 |

---

## 핵심 설계 결정

### 1. 하이브리드 검색 (Lexical + Semantic)

**문제**: 단일 검색 방식의 한계
- 키워드 검색: 정확한 매칭에 강하지만 동의어 처리 약함
- 시맨틱 검색: 의미 이해에 강하지만 정확한 용어 매칭 약함

**해결**: RRF (Reciprocal Rank Fusion) 하이브리드 검색
```typescript
score(doc) = Σ [ 1 / (k + rank_i(doc)) ]
```

**기술 선택**:
- **FTS5 with Trigram**: 한국어 부분 매칭에 최적화
- **Vectorize with text-embedding-3-small**: 높은 품질의 임베딩
- **k=60**: IR 연구에서 검증된 최적값

**장점**:
- 두 검색 방식의 장점 결합
- 한국어 형태소 처리 우수
- 검색 정확도 향상

### 2. RAG 청킹 전략

**문제**: 긴 문서를 어떻게 나눌 것인가?

**해결**: 슬라이딩 윈도우 with 20% Overlap
```typescript
{
  size: 512 tokens,
  overlap: 0.2 (102 tokens),
  step: 410 tokens
}
```

**근거**:
- 512 tokens: GPT-4.5 컨텍스트에 적합한 크기
- 20% overlap: 청크 경계에서 정보 손실 방지
- Character-based tokenization: Workers 환경에서 빠른 근사치

**메타데이터 설계**:
```typescript
{
  work_id: string,        // 8 bytes
  scope: string,          // 6 bytes (GLOBAL/PERSON/DEPT/WORK/PROJECT)
  category: string,       // 20 bytes (업무 구분)
  created_at_bucket: string, // 7 bytes (2025-11)
}
```
- Vectorize 메타데이터 64-byte 제한 준수
- 필터링 가능한 최소 필드만 포함

### 3. PDF 비동기 처리

**문제**: PDF 처리는 시간이 오래 걸림 (Workers 30초 CPU 제한)

**해결**: Queue-based Async Processing
```
Upload → Queue → Consumer → Result
```

**흐름**:
1. Worker API: PDF를 R2에 업로드, Queue에 메시지 전송
2. Queue Consumer: PDF 추출, AI 초안 생성
3. Worker API: 폴링으로 결과 조회

**장점**:
- Workers CPU 제한 회피
- 자동 재시도 (Queue 기본 기능)
- 확장 가능 (배치 처리)

**트레이드오프**:
- 동기 응답 불가 (폴링 필요)
- Queue는 유료 플랜 필요 (무료 플랜 제한 있음)

### 4. 버전 관리 전략

**문제**: 모든 버전을 저장하면 스토리지 증가

**해결**: 자동 Pruning (최근 5개 보관)
```sql
DELETE FROM work_note_versions
WHERE id IN (
  SELECT id FROM work_note_versions
  WHERE work_id = ?
  ORDER BY version_no DESC
  LIMIT -1 OFFSET 5
)
```

**근거**:
- 최근 버전이 가장 유용
- 스토리지 비용 제한
- 자동 관리 (사용자 개입 불필요)

### 5. 할 일 반복 로직

**문제**: 정기 업무를 어떻게 자동화할 것인가?

**해결**: 2가지 반복 유형

**DUE_DATE (기한 기준)**:
```
next_due = previous_due + interval
예: 매주 월요일 회의
```

**COMPLETION_DATE (완료일 기준)**:
```
next_due = completion_date + interval
예: 자동차 오일 교환 (교환 후 3개월)
```

**구현**:
- Strategy Pattern으로 확장 가능
- 완료 시 자동으로 다음 인스턴스 생성
- 원본 todo_id 유지하여 그룹화 가능

### 6. 임베딩 재시도 메커니즘

**문제**: Vectorize 임베딩 실패 시 데이터 일관성 손실

**해결**: Exponential Backoff Retry Queue

**정책**:
- 최대 3회 재시도
- 지수 백오프: 2^n초 (2s, 4s, 8s)
- 3회 실패 → Dead Letter Queue

**데이터베이스**:
```sql
CREATE TABLE embedding_retry_queue (
  retry_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TEXT,
  error_details TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**장점**:
- Eventual Consistency 보장
- 네트워크 일시 오류 복구
- 관리자 개입 지점 (Dead Letter)

---

## 데이터 모델

### ERD (Entity Relationship Diagram)

```
┌────────────┐         ┌───────────────┐         ┌──────────────┐
│  persons   │1      N │ person_dept_  │N      1 │ departments  │
│            │────────→│   history     │←────────│              │
│ person_id* │         │               │         │ dept_name*   │
│ name       │         │ person_id FK  │         │ description  │
│ current_   │         │ dept_name FK  │         │ created_at   │
│   dept     │         │ position      │         │ updated_at   │
│ ...        │         │ is_active     │         │              │
└─────┬──────┘         └───────────────┘         └──────────────┘
      │
      │N
      ↓
┌───────────────┐      ┌───────────────┐
│ work_note_    │      │  work_notes   │
│   person      │N   1 │               │
│               │←─────│ work_id*      │
│ work_id FK    │      │ title         │
│ person_id FK  │      │ content_raw   │
│ role          │      │ category      │
└───────────────┘      │ project_id FK │
                       │ created_at    │
                       │ updated_at    │
                       │ deleted_at    │
                       └───────┬───────┘
                               │
                ┌──────────────┼──────────────┐
                │1             │1             │1
                ↓              ↓              ↓
        ┌───────────┐  ┌──────────┐  ┌──────────┐
        │  todos    │  │ work_    │  │  notes   │
        │           │  │ note_    │  │  _fts    │
        │ todo_id*  │  │ versions │  │ (Virtual)│
        │ work_id FK│  │          │  │          │
        │ title     │  │ work_id  │  │ title    │
        │ status    │  │ version  │  │ content  │
        │ due_date  │  │ content  │  │          │
        │ repeat_   │  │ created  │  │          │
        │   rule    │  │   _at    │  │          │
        └───────────┘  └──────────┘  └──────────┘

┌──────────────┐         ┌───────────────┐
│  projects    │1      N │  project_     │
│              │────────→│    work_      │
│ project_id*  │         │    notes      │
│ title        │         │               │
│ status       │         │ project_id FK │
│ priority     │         │ work_id FK    │
│ leader FK    │         │               │
│ dept FK      │         │               │
│ start_date   │         │               │
│ end_date     │         │               │
│ deleted_at   │         │               │
└──────┬───────┘         └───────────────┘
       │
       │1
       ↓
┌───────────────┐      ┌───────────────┐
│  project_     │      │  project_     │
│  participants │      │  files        │
│               │      │               │
│ project_id FK │      │ file_id*      │
│ person_id FK  │      │ project_id FK │
└───────────────┘      │ original_name │
                       │ mime_type     │
                       │ size          │
                       │ uploaded_by   │
                       │ embedded_at   │
                       │ deleted_at    │
                       └───────────────┘
```

### 핵심 테이블

#### work_notes (업무노트)
```sql
CREATE TABLE work_notes (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_raw TEXT NOT NULL,
  category TEXT,
  project_id TEXT REFERENCES projects(project_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

#### persons (사람)
```sql
CREATE TABLE persons (
  person_id TEXT PRIMARY KEY,      -- 6자리 사번
  name TEXT NOT NULL,
  current_dept TEXT REFERENCES departments(dept_name),
  current_position TEXT,
  current_role_desc TEXT,
  phone_ext TEXT,
  employment_status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### todos (할 일)
```sql
CREATE TABLE todos (
  todo_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT '진행중',
  wait_until TEXT,
  due_date TEXT,
  repeat_rule TEXT DEFAULT 'NONE',
  recurrence_type TEXT DEFAULT 'DUE_DATE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 인덱스 전략

```sql
-- Foreign Keys
CREATE INDEX idx_work_note_person_work_id ON work_note_person(work_id);
CREATE INDEX idx_work_note_person_person_id ON work_note_person(person_id);

-- Filters
CREATE INDEX idx_work_notes_category ON work_notes(category);
CREATE INDEX idx_work_notes_created_at ON work_notes(created_at);
CREATE INDEX idx_work_notes_project_id ON work_notes(project_id);

-- Todos
CREATE INDEX idx_todos_work_id ON todos(work_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_wait_until ON todos(wait_until);

-- Composite
CREATE INDEX idx_todos_status_due ON todos(status, due_date);
```

---

## API 설계

### RESTful 원칙

- **리소스 중심**: `/work-notes`, `/persons`, `/projects`
- **HTTP 메서드**: GET (조회), POST (생성), PUT (수정), PATCH (부분 수정), DELETE (삭제)
- **상태 코드**: 200 (성공), 201 (생성), 204 (삭제), 400 (잘못된 요청), 401 (인증 실패), 404 (없음), 409 (충돌), 429 (Rate Limit)

### 엔드포인트 구조

```
/api
├── /me                        # 현재 사용자 정보
├── /persons                   # 사람 관리
│   ├── GET /                  # 목록 조회
│   ├── POST /                 # 생성
│   ├── GET /:personId         # 상세 조회
│   ├── PUT /:personId         # 수정
│   ├── GET /:personId/history # 부서 이력
│   └── GET /:personId/work-notes # 관련 업무노트
├── /departments               # 부서 관리
│   ├── GET /                  # 목록 조회
│   ├── POST /                 # 생성
│   ├── GET /:deptName         # 상세 조회
│   ├── PUT /:deptName         # 수정
│   └── GET /:deptName/work-notes # 관련 업무노트
├── /work-notes                # 업무노트 관리
│   ├── GET /                  # 목록 조회 (필터링)
│   ├── POST /                 # 생성
│   ├── GET /:workId           # 상세 조회
│   ├── PUT /:workId           # 수정
│   ├── DELETE /:workId        # 삭제
│   └── /:workId/todos         # 할 일 관리
│       ├── GET /              # 목록 조회
│       └── POST /             # 생성
├── /todos                     # 할 일 관리
│   ├── GET /                  # 목록 조회 (뷰 필터)
│   └── PATCH /:todoId         # 상태 변경
├── /projects                  # 프로젝트 관리
│   ├── GET /                  # 목록 조회
│   ├── POST /                 # 생성
│   ├── GET /:projectId        # 상세 조회
│   ├── PUT /:projectId        # 수정
│   ├── DELETE /:projectId     # 소프트 삭제
│   ├── GET /:projectId/stats  # 통계
│   ├── /participants          # 참여자 관리
│   ├── /work-notes            # 업무노트 연결
│   └── /files                 # 파일 관리
├── /search                    # 검색
│   └── POST /work-notes       # 하이브리드 검색
├── /rag                       # RAG
│   └── POST /query            # 챗봇 질의
├── /ai                        # AI
│   ├── POST /work-notes/draft-from-text # 텍스트 초안
│   └── POST /work-notes/:workId/todo-suggestions # 할 일 제안
├── /pdf-jobs                  # PDF 처리
│   ├── POST /                 # PDF 업로드
│   └── GET /:jobId            # 작업 상태 조회
├── /statistics                # 통계
│   └── GET /                  # 기간별 통계
├── /task-categories           # 업무 구분
│   ├── GET /                  # 목록
│   ├── POST /                 # 생성
│   ├── PUT /:categoryId       # 수정
│   └── DELETE /:categoryId    # 삭제
└── /admin                     # 관리자
    └── /embedding-failures    # 임베딩 실패 관리
```

### Request/Response 형식

**요청**:
```json
{
  "title": "string",
  "content": "string",
  "category": ["string"],
  "personIds": ["string"],
  "relatedWorkIds": ["string"]
}
```

**응답 (성공)**:
```json
{
  "workId": "WORK-abc123",
  "title": "string",
  "content": "string",
  "category": ["string"],
  "persons": [
    {
      "personId": "123456",
      "name": "홍길동",
      "currentDept": "개발팀",
      "role": "OWNER"
    }
  ],
  "createdAt": "2025-12-01T10:30:00.000Z",
  "updatedAt": "2025-12-01T10:30:00.000Z"
}
```

**응답 (오류)**:
```json
{
  "code": "NOT_FOUND",
  "message": "Work note not found: WORK-abc123",
  "details": null
}
```

---

## 검색 시스템

### FTS5 (Full-Text Search)

**설정**:
```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  content_raw,
  tokenize='trigram'
);
```

**트리그램 토크나이저**:
- 한국어 형태소 처리 우수
- 부분 매칭 지원
- 예: "업무노트" → "업무", "무노", "노트"

**검색 쿼리**:
```sql
SELECT work_id, rank
FROM notes_fts
WHERE notes_fts MATCH ?
ORDER BY rank
LIMIT 20;
```

### Vectorize (Semantic Search)

**인덱스 설정**:
```
Dimensions: 1536
Metric: cosine
Model: text-embedding-3-small
```

**임베딩 생성**:
```typescript
const embedding = await env.AI_GATEWAY.run('openai/text-embedding-3-small', {
  input: chunkText
});
```

**검색**:
```typescript
const results = await env.VECTORIZE.query(queryEmbedding, {
  topK: 20,
  filter: {
    scope: 'PERSON',
    entityId: 'person-123'
  },
  returnMetadata: true
});
```

### RRF (Reciprocal Rank Fusion)

**알고리즘**:
```typescript
function mergeResults(lexical: Result[], semantic: Result[], k = 60): Result[] {
  const scoreMap = new Map<string, number>();

  lexical.forEach((item, rank) => {
    const score = 1 / (k + rank + 1);
    scoreMap.set(item.id, (scoreMap.get(item.id) || 0) + score);
  });

  semantic.forEach((item, rank) => {
    const score = 1 / (k + rank + 1);
    scoreMap.set(item.id, (scoreMap.get(item.id) || 0) + score);
  });

  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

**k=60 선택 근거**:
- IR 연구에서 검증된 최적값
- 너무 작으면 상위 편향, 너무 크면 평탄화

---

## AI 통합

### AI Gateway

**구성**:
```
Provider: OpenAI
Gateway ID: worknote-maker
Features: Rate limiting, Caching, Logging
```

**장점**:
- API 키 보호
- 요청 로깅 및 분석
- Rate Limit 관리
- 캐싱으로 비용 절감

### GPT-4.5 활용

**용도**:
1. **초안 생성**: 텍스트/PDF → 구조화된 업무노트
2. **할 일 추출**: 업무 내용 → 할 일 목록
3. **RAG 답변**: 질문 + 검색 결과 → 맥락적 답변

**프롬프트 설계**:
```typescript
const prompt = `당신은 업무 관리 전문가입니다.
다음 업무 내용을 분석하여 구조화된 업무노트를 작성하세요.

업무 내용:
${inputText}

출력 형식 (JSON):
{
  "title": "명확한 제목",
  "content": "상세 내용 (Markdown)",
  "category": ["업무 구분"],
  "todos": [
    {
      "title": "할 일 제목",
      "description": "상세 설명",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}`;
```

**파라미터**:
- `model`: `gpt-4.5`
- `temperature`: `0.7` (창의성과 일관성 균형)
- `max_tokens`: `2000`

### text-embedding-3-small

**특징**:
- Dimensions: 1536
- 성능: 고품질, 저비용
- 속도: 빠름

**사용**:
```typescript
const response = await env.AI_GATEWAY.run('openai/text-embedding-3-small', {
  input: [chunk1, chunk2, chunk3],  // 배치 처리
  model: 'text-embedding-3-small'
});

const embeddings = response.data.map(d => d.embedding);
```

---

## 비동기 처리

### Cloudflare Queues

**PDF 처리 Queue**:
```typescript
// Producer
await env.PDF_QUEUE.send({
  jobId: 'job-123',
  r2Key: 'pdfs/temp/file.pdf',
  metadata: {
    category: ['회의'],
    personIds: ['123456']
  }
});

// Consumer
export default {
  async queue(batch: MessageBatch, env: Env) {
    for (const message of batch.messages) {
      await processPdfJob(message.body, env);
      message.ack();
    }
  }
};
```

**배치 설정**:
```toml
[[queues.consumers]]
queue = "pdf-processing-queue"
max_batch_size = 10
max_batch_timeout = 30
```

### 임베딩 재시도 Queue

**데이터베이스 기반**:
```typescript
// Enqueue
await embeddingRetryService.enqueueRetry(workId, error);

// Process (Cron Trigger로 실행)
const items = await embeddingRetryService.getRetryableItems(10);
for (const item of items) {
  try {
    await embedWorkNote(item.workId);
    await embeddingRetryService.markSuccess(item.retryId);
  } catch (error) {
    await embeddingRetryService.incrementAttempt(item.retryId, error);
  }
}
```

---

## 보안 및 인증

### Cloudflare Access

**OAuth 2.0 with Google**:
1. User → Google 로그인
2. Google → Cloudflare Access (토큰 교환)
3. Cloudflare → Header 주입: `Cf-Access-Authenticated-User-Email`
4. Worker → 헤더 검증

**인증 미들웨어**:
```typescript
async function authMiddleware(c: Context, next: Next) {
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ||
                c.req.header('X-Test-User-Email'); // Dev fallback

  if (!email) {
    throw new AuthenticationError('Unauthorized');
  }

  c.set('user', { email });
  await next();
}
```

### CORS

프론트엔드와 API가 같은 도메인에 배포되므로 CORS 불필요.

### 데이터 보호

- **암호화**: Cloudflare는 모든 데이터를 at-rest 암호화
- **접근 제어**: 단일 사용자 시스템, Cloudflare Access로 보호
- **API 키**: Wrangler secrets로 안전하게 저장

---

## 성능 최적화

### 1. 엣지 컴퓨팅

Cloudflare Workers는 전 세계 300+ 엣지 로케이션에 배포:
- 사용자와 가장 가까운 데이터센터에서 실행
- Cold Start: ~1ms
- 평균 응답 시간: <50ms (글로벌)

### 2. D1 최적화

**인덱스 전략**:
- Foreign Key 자동 인덱싱
- 필터 컬럼 인덱싱
- Composite 인덱스 (status + due_date)

**배치 쿼리**:
```typescript
const results = await env.DB.batch([
  query1,
  query2,
  query3
]);
```
- 단일 라운드트립
- 원자성 보장

### 3. Vectorize 최적화

**메타데이터 필터**:
```typescript
await env.VECTORIZE.query(embedding, {
  filter: { scope: 'PERSON', entityId: '123456' },
  topK: 20
});
```
- 검색 공간 축소
- 응답 시간 단축

### 4. 프론트엔드 최적화

**코드 스플리팅**:
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WorkNotes = lazy(() => import('./pages/WorkNotes'));
```

**TanStack Query 캐싱**:
```typescript
const { data } = useQuery({
  queryKey: ['work-notes', filters],
  queryFn: () => API.getWorkNotes(filters),
  staleTime: 5 * 60 * 1000  // 5분
});
```

**Optimistic Updates**:
```typescript
mutate({
  onMutate: async (newTodo) => {
    // Optimistic update
    queryClient.setQueryData(['todos'], old => [...old, newTodo]);
  },
  onError: (err, newTodo, context) => {
    // Rollback
    queryClient.setQueryData(['todos'], context.previousTodos);
  }
});
```

---

## 확장성 고려사항

### 수평 확장

Cloudflare Workers는 자동으로 수평 확장:
- 트래픽 증가 시 자동으로 인스턴스 추가
- 무한 동시 요청 처리 가능

### 데이터베이스 확장

D1 제한:
- 데이터베이스 크기: 500MB (무료), 10GB (유료)
- 쿼리당 응답 크기: 1MB

**확장 전략**:
1. **샤딩**: 연도별 데이터베이스 분리
2. **아카이빙**: 오래된 데이터 R2로 이동
3. **Durable Objects**: 상태 필요 시 활용

### 비용 최적화

**무료 티어 활용**:
- Workers: 100,000 req/day
- D1: 5M reads/day, 100K writes/day
- Vectorize: 30M queries/month
- R2: 10GB storage, 1M Class A operations
- Queues: 1M operations

**유료 전환 시점**:
- Daily Active Users > 1,000
- 또는 D1 writes > 100K/day

---

## 참고 문서

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [RRF Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [RAG Best Practices](https://www.anthropic.com/index/contextual-retrieval)
- [Vectorize Docs](https://developers.cloudflare.com/vectorize/)

---

**마지막 업데이트**: 2025-12-01
