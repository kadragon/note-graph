# Google Calendar 연동 구현 계획

## 개요
대시보드의 할일 목록 상단에 Google Calendar 2주간(이번주 + 다음주) 일정을 캘린더 형식으로 표시

## Phase 1: OAuth 스코프 확장

### 1.1 OAuth 서비스 스코프 추가
- [x] GoogleOAuthService의 SCOPES 배열에 calendar.readonly 추가 테스트
- [x] 기존 Drive 연동이 정상 동작하는지 확인하는 테스트

## Phase 2: Google Calendar 서비스 (백엔드)

### 2.1 Calendar 서비스 기본 구조
- [x] GoogleCalendarService 클래스 생성 테스트 (constructor, 의존성 주입)
- [x] getEvents() 메서드 - 날짜 범위로 이벤트 조회 테스트
- [x] 이벤트 응답 파싱 및 타입 변환 테스트

### 2.2 Calendar API 엔드포인트
- [x] GET /api/calendar/events 라우트 생성 테스트
- [x] 쿼리 파라미터 검증 (startDate, endDate) 테스트
- [x] 인증되지 않은 사용자 접근 거부 테스트
- [x] Google 계정 미연결 시 적절한 에러 응답 테스트

## Phase 3: 프론트엔드 훅

### 3.1 API 클라이언트
- [x] API.getCalendarEvents() 메서드 추가 테스트
- [x] CalendarEvent 타입 정의

### 3.2 React Query 훅
- [x] useCalendarEvents(startDate, endDate) 훅 테스트
- [x] Google 미연결 시 쿼리 비활성화 테스트
- [x] 에러 처리 테스트

## Phase 4: 캘린더 UI 컴포넌트

### 4.1 WeekCalendar 컴포넌트
- [x] 2주간 날짜 그리드 렌더링 테스트
- [x] 이벤트가 해당 날짜 셀에 표시되는지 테스트
- [x] 오늘 날짜 하이라이트 테스트
- [x] 종일 이벤트 표시 테스트
- [x] 시간 지정 이벤트 표시 테스트

### 4.2 캘린더 스타일링
- [x] 로딩 상태 표시 테스트
- [x] 빈 상태 (이벤트 없음) 표시 테스트
- [x] Google 미연결 상태 표시 테스트

## Phase 5: 대시보드 통합

### 5.1 Dashboard 컴포넌트 수정
- [x] CalendarCard 컴포넌트를 할일 목록 상단에 배치 테스트
- [x] Google 연결 상태에 따른 조건부 렌더링 테스트

## Phase 6: 버그 수정

### 6.1 캘린더 스코프 미확인 수정
- [x] 저장된 토큰에 calendar.readonly 스코프가 없으면 GOOGLE_NOT_CONNECTED 에러 반환 테스트
- [x] Calendar API 403 응답을 GOOGLE_NOT_CONNECTED로 매핑하는 테스트

### 6.2 UTC 시간대 문제 수정
- [x] 날짜 문자열을 로컬 시간 기준으로 변환하는 테스트 (KST 00:00 ~ 23:59:59)

## 기술 상세

### OAuth 스코프
```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly'
];
```

### Google Calendar API
```
GET https://www.googleapis.com/calendar/v3/calendars/primary/events
  ?timeMin={startDate}
  &timeMax={endDate}
  &singleEvents=true
  &orderBy=startTime
```

### CalendarEvent 타입
```typescript
interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
}
```

### 파일 구조
```
apps/worker/src/
  services/google-calendar-service.ts
  routes/calendar.ts

apps/web/src/
  hooks/use-calendar.ts
  pages/dashboard/components/calendar-card.tsx
  pages/dashboard/components/week-calendar.tsx
  types/api.ts (CalendarEvent 추가)
```

---

# Analytics & Performance Refactoring Plan

## Analytics Insights
- **No external analytics library** – uses Cloudflare AI Gateway (OpenAI), custom StatisticsService, console logging, DB state columns
- **No duplication detected** – analytics is already centralized
- **Opportunity**: formalize event tracking if real-time observability needed

---

## Worker Performance (Critical Path)

### N+1 Query Patterns
- [ ] RAG context: batch fetch work notes by IDs instead of sequential loop (RagService#L143-L187)
- [ ] Embedding reindex: load all notes with details in one query, not one-by-one (EmbeddingProcessor#L117-L138)

### Sequential Database Operations
- [ ] WorkNoteRepository.update: use db.batch() for INSERT/DELETE statements (WorkNoteRepository#L721-L725)
- [ ] EmbeddingProcessor: parallelize note updates in batch reindexing (EmbeddingProcessor#L405-L420)

### FTS & Search Optimization
- [ ] FtsSearchService: optimize FTS join strategy to filter before full table scan (FtsSearchService#L28-L41)
- [ ] StatisticsRepository: replace `.map().join(',')` large IN clauses with CTEs or subqueries (StatisticsRepository#L156-L169)

---

## Web Performance (User-Facing)

### API Call Waterfall
- [ ] useWorkNotesWithStats: batch fetch todos (single API call instead of N+1) (useWorkNotesWithStats#L21-L94)
- [ ] ViewWorkNoteDialog: deduplicate list/detail fetches via React Query cache (ViewWorkNoteDialog#L137-L149)

### React Query Integration
- [ ] useStatistics: migrate from manual useState/useEffect to React Query (useStatistics#L23-L68)
- [ ] useGoogleDriveStatus: enable proper caching with staleTime/retry strategy (useWorkNotes#L187-L193)

### Render Optimization
- [ ] WorkNotes: split 6-tab memoization into separate computed lists or move to selector (WorkNotes#L66-L112)
- [ ] PersonDialog: consolidate 10+ useState fields into a single form reducer (PersonDialog#L56-L65)

### Bundle Size
- [ ] ViewWorkNoteDialog: lazy-load react-markdown + rehype/remark plugins (ViewWorkNoteDialog#L51-L62)

---

## Test Suite Compaction & Maintenance

### Current State
- **563 total test files** across `tests/` and `apps/web/src`
- **589 tests total** (3 currently failing)
- **13,280 lines of test code**
- Large test files: `work-note-repository.test.ts` (908 lines, 59 describe/it), `todo-repository.test.ts` (887 lines, 50 describe/it), `use-projects.test.ts` (990 lines)

### Redundant Test Coverage
- `tests/api.test.ts` (107 lines): basic endpoint tests (health, auth, 404)—covered by route-specific integration tests
- `tests/departments.test.ts` (50 lines): department search—duplicates `tests/unit/department-repository.test.ts` (541 lines)
- `tests/person.test.ts` (188 lines): person creation—overlaps with `person-repository.test.ts` and API integration

### Fix Failing Tests
- [ ] Fix Google Drive service mocking in `google-drive-service.test.ts` (2 failures: folder creation, INSERT OR IGNORE)
- [ ] Fix `migrate-r2-to-gdrive.test.ts` (1 failure: R2 migration test)

### Compact Redundant Tests
- [ ] Delete `tests/api.test.ts` (endpoint coverage exists in route-specific tests)
- [ ] Delete `tests/departments.test.ts` (redundant with `department-repository.test.ts`)
- [ ] Merge `tests/person.test.ts` import tests into `person-repository.test.ts`

### Split Large Test Files
- [ ] Split `work-note-repository.test.ts` (908 lines) into: findById, findAll, CRUD, versions, associations
- [ ] Split `todo-repository.test.ts` (887 lines) into: basic CRUD, recurrence logic, filtering/views
- [ ] Split `use-projects.test.ts` (990 lines) into: list/fetch, CRUD mutations, error handling

---

## Priority Order
1. **Worker N+1 Queries** (highest impact on latency)
2. **Web API Waterfall** (highest impact on user responsiveness)
3. **Fix Failing Tests** (unblocks PR merge)
4. **Compact Redundant Tests** (improves maintainability)
5. **Sequential DB Operations** (improves batch job throughput)
6. **React Query Migrations** (improves cache hit rates)
7. **Render Optimizations** (improves perceived performance)
8. **Bundle Size** (improves initial load)
9. **Split Large Test Files** (improves readability, reduces cognitive load)
