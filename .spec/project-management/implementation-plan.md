# Project Management Feature - Implementation Plan

## Overview

프로젝트 관리 기능은 업무노트 시스템에 프로젝트 개념을 추가하여, 관련된 업무노트와 파일을 하나의 프로젝트로 묶어 관리할 수 있게 합니다.

## Key Requirements (User Input)

1. **관계 구조**: 프로젝트가 업무노트를 포함 (1:N)
   - 업무노트는 0개 또는 1개의 프로젝트에만 속함
   - 프로젝트는 여러 업무노트를 가질 수 있음

2. **RAG 범위**: 프로젝트 필터 추가
   - 기존 GLOBAL/PERSON/DEPT/WORK 범위에 PROJECT 추가
   - 프로젝트 ID로 검색 범위 제한
   - 메타데이터 필터링 방식 사용

3. **파일 타입**: PDF, 이미지, Office 문서
   - R2에 영구 저장 (기존 PDF 임시 저장과 다름)
   - 텍스트 추출 가능한 파일은 자동 임베딩
   - 50MB 파일 크기 제한

4. **필수 속성**:
   - 기본 정보: 이름, 설명, 상태 (진행중/완료/보류/중단)
   - 기간 정보: 시작일, 목표 종료일, 실제 종료일
   - 담당자/팀: 리더, 참여자, 담당 부서
   - 태그/분류: 카테고리, 태그, 우선순위

## Architecture

### Database Schema

```sql
-- 프로젝트 메인 테이블
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,           -- PROJECT-{nanoid}
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,                  -- 진행중|완료|보류|중단
  tags TEXT,                             -- JSON array or comma-separated
  priority TEXT,                         -- 높음|중간|낮음
  start_date TEXT,
  target_end_date TEXT,
  actual_end_date TEXT,
  leader_person_id TEXT REFERENCES persons(person_id),
  dept_name TEXT REFERENCES departments(dept_name),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT                        -- Soft delete
);

-- 프로젝트 참여자
CREATE TABLE project_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(project_id) ON DELETE CASCADE,
  person_id TEXT REFERENCES persons(person_id) ON DELETE CASCADE,
  role TEXT,                             -- 리더|참여자|검토자
  joined_at TEXT NOT NULL
);

-- 프로젝트-업무노트 연결
CREATE TABLE project_work_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(project_id) ON DELETE CASCADE,
  work_id TEXT REFERENCES work_notes(work_id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  UNIQUE(work_id)                        -- 1:N 관계 강제
);

-- 프로젝트 파일
CREATE TABLE project_files (
  file_id TEXT PRIMARY KEY,              -- FILE-{nanoid}
  project_id TEXT REFERENCES projects(project_id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,                  -- projects/{projectId}/files/{fileId}
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,               -- MIME type
  file_size INTEGER NOT NULL,            -- bytes
  uploaded_by TEXT NOT NULL,             -- email
  uploaded_at TEXT NOT NULL,
  embedded_at TEXT,                      -- NULL if not embedded
  deleted_at TEXT                        -- Soft delete
);

-- 기존 테이블 수정
ALTER TABLE work_notes ADD COLUMN project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL;
```

### R2 Storage Structure

```
projects/
  {projectId}/
    files/
      {fileId}.{ext}           # Active files
    archive/
      {fileId}.{ext}           # Soft-deleted files (moved on delete)
```

### Vectorize Metadata Extension

```typescript
interface ChunkMetadata {
  workId: string;
  projectId: string | null;     // NEW: Project association
  scope: 'GLOBAL' | 'PERSON' | 'DEPT' | 'WORK' | 'PROJECT';  // Add PROJECT
  entityId: string;
  createdAtBucket: string;
}
```

## API Endpoints

### Project Management
- `POST   /projects` - Create project
- `GET    /projects` - List projects (filters: status, personId, dateRange)
- `GET    /projects/:projectId` - Get project detail
- `PUT    /projects/:projectId` - Update project
- `DELETE /projects/:projectId` - Soft delete project
- `GET    /projects/:projectId/stats` - Get statistics

### Work Note Association
- `POST   /projects/:projectId/work-notes` - Assign work note
- `GET    /projects/:projectId/work-notes` - List project work notes
- `DELETE /projects/:projectId/work-notes/:workId` - Remove work note

### File Management
- `POST   /projects/:projectId/files` - Upload file (multipart/form-data)
- `GET    /projects/:projectId/files` - List files
- `GET    /projects/:projectId/files/:fileId` - Get file metadata
- `GET    /projects/:projectId/files/:fileId/download` - Get presigned download URL (1hr)
- `DELETE /projects/:projectId/files/:fileId` - Soft delete file

### RAG Extension
- `POST /rag/query` - Extended to support `scope=PROJECT` with `projectId` parameter

## Implementation Phases

### Phase 1: Backend Core (14 hours)
**Tasks: TASK-035, TASK-036, TASK-037, TASK-038**

1. **Database Schema** (TASK-035, 3h)
   - Create migration 0014_add_project_management.sql
   - Add 4 new tables with proper constraints
   - Add indexes for efficient queries
   - Test migration locally

2. **Types & Repository** (TASK-036, 4h)
   - Define TypeScript interfaces (Project, ProjectParticipant, ProjectFile, ProjectStats)
   - Implement ProjectRepository with CRUD operations
   - Write unit tests for repository
   - Follow existing repository patterns

3. **API Endpoints** (TASK-037, 4h)
   - Create project routes (Hono handlers)
   - Implement filtering and statistics
   - Add Zod validation schemas
   - Error handling with domain errors

4. **Work Note Association** (TASK-038, 3h)
   - Extend WorkNoteRepository for projectId
   - Create association endpoints
   - Enforce 1:N constraint (409 on duplicate)
   - Update work note creation to accept projectId

### Phase 2: Storage & RAG (11 hours)
**Tasks: TASK-039, TASK-040, TASK-041, TASK-042**

5. **File Upload** (TASK-039, 4h)
   - Create ProjectFileService
   - Implement R2 upload with multipart/form-data
   - File validation (type, size limit 50MB)
   - Store metadata in project_files table

6. **File Download & Delete** (TASK-040, 3h)
   - Generate presigned R2 URLs (1 hour expiry)
   - List files endpoint with metadata
   - Soft delete with archive to R2 archive/ prefix
   - Cleanup logic

7. **RAG Extension** (TASK-041, 3h)
   - Add PROJECT scope to RagService
   - Update chunk metadata to include projectId
   - Implement Vectorize filtering by project
   - Ensure backward compatibility with existing scopes

8. **File Processing Pipeline** (TASK-042, 5h)
   - Create FILE_PROCESSING_QUEUE in wrangler.toml
   - Implement queue consumer for text extraction
   - Support PDF, DOCX, TXT extraction
   - Chunk and embed with projectId metadata
   - Update embedded_at timestamp

### Phase 3: Frontend & Testing (12 hours)
**Tasks: TASK-043, TASK-044**

9. **Frontend UI** (TASK-043, 8h)
   - Project list page with filters
   - Create/edit project dialog
   - Project detail view (work notes, files, stats)
   - File upload/download UI (drag-and-drop)
   - Work note assignment interface

10. **Testing** (TASK-044, 4h)
    - Unit tests for ProjectRepository
    - Integration tests for all API endpoints
    - RAG PROJECT scope tests
    - File upload/download tests with R2 mock
    - All 21 acceptance tests from spec

## Technical Considerations

### File Processing Queue
Similar to existing PDF processing but extended:
- **Input**: File upload triggers queue message
- **Processing**: Extract text (PDF, DOCX, TXT), chunk, embed
- **Output**: Chunks stored in Vectorize with projectId metadata
- **Error Handling**: Failed extractions logged, no retry (user can re-upload)

### Soft Delete Strategy
- Projects and files use `deleted_at` timestamp
- Deleted files moved to `archive/` prefix in R2
- Queries filter WHERE deleted_at IS NULL by default
- Admin endpoint could restore from archive (future enhancement)

### Performance Optimizations
- Index on `project_id` in work_notes table
- Composite index on (status, created_at) for filtered lists
- Presigned URLs cached client-side with expiry check
- Batch file metadata queries when listing

### Security Considerations
- File upload size limit (50MB) enforced in handler
- MIME type validation against whitelist
- R2 presigned URLs expire after 1 hour
- Only authenticated users can access projects
- File deletion requires project ownership (check via leader_person_id)

## Migration Path

1. **Development**: Run migration locally, test with sample data
2. **Schema Deployment**: Apply migration to production D1
3. **Backend Deployment**: Deploy updated Worker with new routes
4. **Frontend Deployment**: Deploy updated React app
5. **Data Migration**: No existing data to migrate (new feature)

## Monitoring & Maintenance

- Monitor R2 storage growth (project files)
- Track FILE_PROCESSING_QUEUE metrics (success/failure rates)
- Alert on high file upload failures
- Periodic cleanup of old soft-deleted files (future cron job)

## Future Enhancements

- Project templates for quick setup
- Gantt chart view for project timeline
- Project milestones and deliverables
- Project-level permissions (beyond single-user)
- Automatic project archival after completion
- Project export (zip with all files and work notes)

---

**Trace**: SPEC-project-1
**Estimated Total Effort**: 37 hours
**Status**: Planning complete, ready for TASK-035
