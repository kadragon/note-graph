# API 문서

> Worknote Management System의 모든 API 엔드포인트를 설명합니다.

## 기본 정보

- **Base URL**: `https://your-domain.com/api`
- **인증**: Cloudflare Access (Google OAuth)
- **Content-Type**: `application/json`
- **인코딩**: UTF-8

---

## 인증

### GET /me

현재 인증된 사용자 정보를 반환합니다.

**응답**:
```json
{
  "email": "user@example.com"
}
```

---

## 사람 관리

### GET /persons

사람 목록을 조회합니다.

**Query Parameters**:
- `q` (선택): 검색어 (이름 또는 사번)

**응답**:
```json
[
  {
    "personId": "123456",
    "name": "홍길동",
    "currentDept": "개발팀",
    "currentPosition": "팀장",
    "phoneExt": "3346",
    "employmentStatus": "active",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### POST /persons

새 사람을 생성합니다.

**Request Body**:
```json
{
  "personId": "123456",
  "name": "홍길동",
  "currentDept": "개발팀",
  "currentPosition": "팀장",
  "phoneExt": "3346"
}
```

### GET /persons/:personId

사람 상세 정보를 조회합니다.

### PUT /persons/:personId

사람 정보를 수정합니다. 부서 변경 시 자동으로 부서 이력이 생성됩니다.

### GET /persons/:personId/history

사람의 부서 이력을 조회합니다.

**응답**:
```json
[
  {
    "id": 1,
    "personId": "123456",
    "deptName": "개발팀",
    "position": "팀장",
    "startDate": "2025-01-01",
    "endDate": null,
    "isActive": true
  }
]
```

---

## 업무노트 관리

### GET /work-notes

업무노트 목록을 조회합니다.

**Query Parameters**:
- `category` (선택): 업무 구분
- `personId` (선택): 담당자 ID
- `deptName` (선택): 부서명
- `fromDate` (선택): 시작일 (YYYY-MM-DD)
- `toDate` (선택): 종료일 (YYYY-MM-DD)
- `keyword` (선택): 키워드 검색

### POST /work-notes

새 업무노트를 생성합니다.

**Request Body**:
```json
{
  "title": "프로젝트 킥오프 회의",
  "content": "# 회의 내용\n\n- 프로젝트 목표 논의\n- 일정 확정",
  "category": ["회의"],
  "personIds": ["123456"],
  "relatedWorkIds": ["WORK-abc123"],
  "projectId": "proj-001"
}
```

### GET /work-notes/:workId

업무노트 상세 정보를 조회합니다.

### PUT /work-notes/:workId

업무노트를 수정합니다. 자동으로 새 버전이 생성됩니다.

### DELETE /work-notes/:workId

업무노트를 삭제합니다.

---

## 할 일 관리

### GET /todos

할 일 목록을 조회합니다.

**Query Parameters**:
- `view` (선택): `today`, `this_week`, `this_month`, `backlog`, `all`

### POST /work-notes/:workId/todos

업무노트에 할 일을 추가합니다.

**Request Body**:
```json
{
  "title": "회의록 작성",
  "description": "회의 내용 정리",
  "waitUntil": "2025-12-01",
  "dueDate": "2025-12-05",
  "repeatRule": "WEEKLY",
  "recurrenceType": "DUE_DATE"
}
```

### PATCH /todos/:todoId

할 일 상태를 변경합니다.

**Request Body**:
```json
{
  "status": "완료"
}
```

---

## 검색

### POST /search/work-notes

하이브리드 검색을 수행합니다.

**Request Body**:
```json
{
  "query": "프로젝트 진행 현황"
}
```

**응답**:
```json
{
  "results": [
    {
      "workId": "WORK-abc123",
      "title": "프로젝트 진행 현황",
      "score": 0.95
    }
  ]
}
```

---

## RAG

### POST /rag/query

AI 챗봇에 질문합니다.

**Request Body**:
```json
{
  "query": "지난달 진행한 회의 내용은?",
  "scope": "GLOBAL",
  "personId": null,
  "deptName": null,
  "workId": null,
  "projectId": null
}
```

**응답**:
```json
{
  "answer": "지난달에는 다음과 같은 회의가 진행되었습니다...",
  "sources": [
    {
      "workId": "WORK-abc123",
      "title": "프로젝트 킥오프 회의",
      "similarity": 0.92
    }
  ]
}
```

---

## AI

### POST /ai/work-notes/draft-from-text

텍스트에서 AI 초안을 생성합니다.

**Request Body**:
```json
{
  "text": "오늘 프로젝트 회의...",
  "category": ["회의"],
  "personIds": ["123456"]
}
```

**응답**:
```json
{
  "draft": {
    "title": "프로젝트 킥오프 회의",
    "content": "# 회의 내용...",
    "category": ["회의"],
    "todos": [
      {
        "title": "회의록 작성",
        "description": "회의 내용 정리"
      }
    ]
  },
  "references": [
    {
      "workId": "WORK-abc123",
      "title": "이전 회의",
      "similarity": 0.85
    }
  ]
}
```

---

## 프로젝트 관리

### GET /projects

프로젝트 목록을 조회합니다.

**Query Parameters**:
- `status` (선택): `활성`, `보류`, `완료`, `취소`
- `leaderId` (선택): 리더 ID
- `deptName` (선택): 부서명

### POST /projects

새 프로젝트를 생성합니다.

**Request Body**:
```json
{
  "title": "신규 프로젝트",
  "description": "프로젝트 설명",
  "status": "활성",
  "priority": "높음",
  "leaderId": "123456",
  "deptName": "개발팀",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "tags": "tag1,tag2",
  "participantIds": ["123456", "789012"]
}
```

### POST /projects/:projectId/files

프로젝트에 파일을 업로드합니다.

**Request**: `multipart/form-data`
- `file`: 파일 (최대 50MB)

### GET /projects/:projectId/files/:fileId/download

파일을 다운로드합니다.

---

## 통계

### GET /statistics

기간별 통계를 조회합니다.

**Query Parameters**:
- `period`: `this-week`, `this-month`, `first-half`, `second-half`, `this-year`, `last-week`
- `year`: 연도 (예: `2025`)

**응답**:
```json
{
  "summary": {
    "totalWorkNotes": 150,
    "totalCompletedTodos": 320,
    "completionRate": 85.5
  },
  "byCategory": [
    {
      "category": "회의",
      "count": 45
    }
  ],
  "byPerson": [
    {
      "personId": "123456",
      "name": "홍길동",
      "count": 25
    }
  ]
}
```

---

## 오류 코드

| 코드 | 상태 | 설명 |
|------|------|------|
| `NOT_FOUND` | 404 | 리소스를 찾을 수 없음 |
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 |
| `CONFLICT` | 409 | 리소스 충돌 (중복 등) |
| `AUTHENTICATION_ERROR` | 401 | 인증 실패 |
| `RATE_LIMIT_ERROR` | 429 | API 호출 제한 초과 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

---

**마지막 업데이트**: 2025-12-01

**참고**: 전체 API 스펙은 `openapi.yaml` 파일을 참조하세요.
