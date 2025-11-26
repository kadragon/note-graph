# Project Management Feature

## 📋 Overview

프로젝트 관리 기능은 업무노트 시스템에 프로젝트 개념을 추가하여, 관련된 업무노트와 파일을 하나의 프로젝트로 묶어 관리할 수 있게 합니다.

### Core Capabilities

- ✅ **프로젝트 CRUD**: 생성, 조회, 수정, 삭제 (소프트 삭제)
- ✅ **업무노트 연결**: 1:N 관계로 프로젝트에 업무노트 할당
- ✅ **파일 관리**: PDF, 이미지, Office 문서를 R2에 영구 저장
- ✅ **RAG 통합**: PROJECT 범위로 프로젝트 내 지식 검색
- ✅ **통계 대시보드**: Todo 완료율, 파일 수, 최근 활동 등

## 🎯 Key Decisions (User Requirements)

| 항목 | 결정사항 | 이유 |
|------|---------|------|
| **프로젝트-업무노트 관계** | 1:N (프로젝트가 업무노트 포함) | 업무노트는 하나의 프로젝트 컨텍스트에만 속함 |
| **RAG 범위** | PROJECT 필터 추가 | 기존 GLOBAL/PERSON/DEPT/WORK와 동일한 메타데이터 필터링 방식 |
| **파일 저장** | R2 영구 저장 | PDF 임시 저장과 달리, 프로젝트 자료는 영구 보관 필요 |
| **파일 타입** | PDF, 이미지, Office 문서 | 텍스트 추출 가능한 파일은 자동 임베딩 |
| **필수 속성** | 이름, 설명, 상태, 기간, 담당자, 태그 | 프로젝트 추적에 필요한 최소 정보 |

## 🏗️ Architecture

### Database Schema

```
projects (메인 테이블)
├── project_id (PK)
├── name, description, status
├── start_date, target_end_date, actual_end_date
├── leader_person_id (FK → persons)
├── dept_name (FK → departments)
└── tags, priority

project_participants (팀 구성)
├── project_id (FK → projects)
└── person_id (FK → persons)

project_work_notes (업무노트 연결)
├── project_id (FK → projects)
└── work_id (FK → work_notes, UNIQUE)  ← 1:N 강제

project_files (파일 첨부)
├── file_id (PK)
├── project_id (FK → projects)
├── r2_key (R2 저장 경로)
└── original_name, file_type, file_size

work_notes (기존 테이블 확장)
└── project_id (FK → projects, nullable)
```

### R2 Storage Structure

```
projects/
  {projectId}/
    files/
      {fileId}.pdf          # 활성 파일
      {fileId}.png
    archive/
      {fileId}.docx         # 삭제된 파일 (소프트 삭제)
```

### Vectorize Metadata Extension

```json
{
  "workId": "WORK-abc123",
  "projectId": "PROJECT-xyz789",  // ← NEW
  "scope": "PROJECT",             // ← NEW scope type
  "entityId": "PROJECT-xyz789",
  "createdAtBucket": "2025-11"
}
```

## 📡 API Endpoints

### Project CRUD
- `POST   /projects` - 프로젝트 생성
- `GET    /projects?status=진행중&personId=P001` - 필터링된 목록
- `GET    /projects/:projectId` - 상세 조회 (work notes, files, stats 포함)
- `PUT    /projects/:projectId` - 수정
- `DELETE /projects/:projectId` - 소프트 삭제
- `GET    /projects/:projectId/stats` - 통계 (todo 완료율, 파일 수 등)

### Work Note Association
- `POST   /projects/:projectId/work-notes { workId }` - 업무노트 할당
- `GET    /projects/:projectId/work-notes` - 프로젝트 업무노트 목록
- `DELETE /projects/:projectId/work-notes/:workId` - 연결 해제

### File Management
- `POST   /projects/:projectId/files` - 파일 업로드 (multipart/form-data, max 50MB)
- `GET    /projects/:projectId/files` - 파일 목록
- `GET    /projects/:projectId/files/:fileId/download` - Presigned URL (1시간 유효)
- `DELETE /projects/:projectId/files/:fileId` - 소프트 삭제 (archive로 이동)

### RAG Extension
- `POST /rag/query { scope: "PROJECT", projectId: "PROJECT-001", query: "..." }`

## 🚀 Implementation Plan

### Phase 1: Backend Core (14h)
| Task | Description | Effort |
|------|-------------|--------|
| TASK-035 | Database schema migration | 3h |
| TASK-036 | Types & ProjectRepository | 4h |
| TASK-037 | API endpoints (CRUD) | 4h |
| TASK-038 | Work note association | 3h |

### Phase 2: Storage & RAG (11h)
| Task | Description | Effort |
|------|-------------|--------|
| TASK-039 | R2 file upload | 4h |
| TASK-040 | File download & deletion | 3h |
| TASK-041 | RAG PROJECT scope | 3h |
| TASK-042 | File processing pipeline | 5h |

### Phase 3: Frontend & Testing (12h)
| Task | Description | Effort |
|------|-------------|--------|
| TASK-043 | React UI (list, detail, file upload) | 8h |
| TASK-044 | Comprehensive tests | 4h |

**Total Estimated Effort**: 37 hours

## ✅ Acceptance Tests

21 comprehensive tests covering:
- Project CRUD operations (TEST-project-1 to TEST-project-6)
- Work note associations (TEST-project-7 to TEST-project-10)
- File management (TEST-project-11 to TEST-project-16)
- RAG integration (TEST-project-17 to TEST-project-19)
- Statistics (TEST-project-20 to TEST-project-21)

See [spec.yaml](./spec.yaml) for full GWT scenarios.

## 🔧 Technical Highlights

### File Processing Pipeline
```
Upload → R2 Storage → Queue Message → Extract Text (PDF/DOCX/TXT)
  → Chunk → Embed with projectId → Update embedded_at
```

### Soft Delete with Archive
```
DELETE /projects/:projectId/files/:fileId
  → Set deleted_at timestamp in DB
  → Move R2 object: files/{fileId} → archive/{fileId}
  → Keep metadata for audit trail
```

### 1:N Relationship Enforcement
```sql
-- project_work_notes has UNIQUE constraint on work_id
INSERT INTO project_work_notes (project_id, work_id)
VALUES ('PROJECT-A', 'WORK-001');  -- OK

INSERT INTO project_work_notes (project_id, work_id)
VALUES ('PROJECT-B', 'WORK-001');  -- ❌ 409 Conflict
```

### RAG Project Filtering
```typescript
// Vectorize query with project metadata filter
const results = await env.VECTORIZE.query(embedding, {
  topK: 10,
  filter: {
    projectId: 'PROJECT-001'  // Only chunks from this project
  }
});
```

## 📊 Statistics Dashboard

Project detail view will show:
- **Todo Progress**: `completedTodos / totalTodos` with percentage
- **File Metrics**: Total count, total size (MB), breakdown by type
- **Recent Activity**: Last updated work note, last file upload
- **Team Info**: Leader, participants with roles
- **Timeline**: Start date, target end date, days remaining/overdue

## 🔮 Future Enhancements

- [ ] Project templates (quick setup for common project types)
- [ ] Gantt chart timeline visualization
- [ ] Project milestones and deliverables tracking
- [ ] Multi-user permissions (beyond current single-user model)
- [ ] Automatic archival of completed projects
- [ ] Export project as zip (all files + work notes in markdown)

## 📚 Related Documentation

- [spec.yaml](./spec.yaml) - Full specification with GWT scenarios
- [implementation-plan.md](./implementation-plan.md) - Detailed implementation guide
- [Task Backlog](../../.tasks/backlog.yaml) - TASK-035 to TASK-044

---

**Trace**: SPEC-project-1
**Status**: ✅ Planning Complete, Ready for Implementation
**Next Step**: Begin TASK-035 (Database Schema Migration)
