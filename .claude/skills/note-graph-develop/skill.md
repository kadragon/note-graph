---
name: note-graph-develop
description: "note-graph 풀스택 기능 개발 오케스트레이터. 백엔드(Hono API) + 프론트엔드(React UI) + 통합 검증을 에이전트 팀으로 조율하여 기능을 구현한다. '기능 추가', '페이지와 API 만들기', '풀스택 구현', '새 기능 개발', 'API + UI 추가' 등 백엔드와 프론트엔드를 함께 수정해야 하는 기능 개발에 이 스킬을 사용할 것. DB 마이그레이션만 필요하면 /create-migration을 사용."
---

# note-graph Feature Development Orchestrator

note-graph 프로젝트의 에이전트 팀을 조율하여 풀스택 기능을 구현하는 통합 스킬.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| backend | backend-dev | API 라우트, 서비스, 레포지토리, 스키마 구현 | backend-implement | 구현 코드 + API 계약 |
| frontend | frontend-dev | 훅, 컴포넌트, 페이지 구현 | frontend-implement | 구현 코드 + 라우트 매핑 |
| qa | integration-qa | 경계면 교차 검증 | integration-verify | 검증 리포트 |

## 워크플로우

### Phase 1: 분석

1. 사용자 요구사항 분석 -- 어떤 기능을 추가/수정하는지 파악
2. 기존 코드 탐색 -- 영향받는 파일, 유사 패턴 식별
3. 구현 범위 결정:
   - DB 스키마 변경 필요 여부 (필요하면 먼저 마이그레이션 생성)
   - 백엔드 변경 범위 (라우트, 서비스, 레포지토리, 스키마)
   - 프론트엔드 변경 범위 (훅, API 클라이언트, 컴포넌트, 페이지)
   - 공유 타입 변경 범위
4. `_workspace/` 디렉토리 생성

### Phase 2: 팀 구성

1. 팀 생성:
   ```
   TeamCreate(
     team_name: "note-graph-dev",
     members: [
       {
         name: "backend",
         agent_type: "backend-dev",
         model: "opus",
         prompt: "note-graph 백엔드 구현 전문가로서 다음 기능을 구현하라: {기능 설명}. 먼저 Skill 도구로 /backend-implement 스킬을 로드한 뒤, 기존 코드 패턴을 읽고, 구현을 시작하라. 구현 완료 시 API 응답 shape을 _workspace/api_contract.md에 문서화하고 frontend에게 SendMessage로 알려라."
       },
       {
         name: "frontend",
         agent_type: "frontend-dev",
         model: "opus",
         prompt: "note-graph 프론트엔드 구현 전문가로서 다음 기능의 UI를 구현하라: {기능 설명}. 먼저 Skill 도구로 /frontend-implement 스킬을 로드한 뒤, backend의 API 계약을 기다려 훅과 API 클라이언트를 구현하라. backend로부터 API 계약을 받으면 바로 구현을 시작하라."
       },
       {
         name: "qa",
         agent_type: "integration-qa",
         model: "opus",
         prompt: "note-graph 통합 정합성 검증 전문가로서 구현된 코드의 경계면을 검증하라. 먼저 Skill 도구로 /integration-verify 스킬을 로드하라. backend와 frontend 각각의 구현이 완료될 때마다 점진적으로 검증하라. 전체 완료 후 종합 리포트를 _workspace/qa_report.md에 저장하라."
       }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     { title: "공유 타입 정의", description: "packages/shared/types/에 새 인터페이스 추가", assignee: "backend" },
     { title: "Zod 스키마 작성", description: "요청 검증 스키마 정의", assignee: "backend" },
     { title: "레포지토리 구현", description: "DB 접근 레이어 구현", assignee: "backend" },
     { title: "서비스 구현", description: "비즈니스 로직 구현", assignee: "backend" },
     { title: "라우트 구현", description: "API 엔드포인트 구현 + 등록", assignee: "backend" },
     { title: "API 계약 문서화", description: "API 응답 shape을 _workspace/에 기록", assignee: "backend", depends_on: ["라우트 구현"] },
     { title: "API 클라이언트 메서드 추가", description: "api.ts에 메서드 추가", assignee: "frontend", depends_on: ["API 계약 문서화"] },
     { title: "React Query 훅 작성", description: "쿼리/뮤테이션 훅 작성", assignee: "frontend", depends_on: ["API 클라이언트 메서드 추가"] },
     { title: "페이지/컴포넌트 구현", description: "UI 구현", assignee: "frontend", depends_on: ["React Query 훅 작성"] },
     { title: "라우트 등록", description: "App.tsx에 새 라우트 추가", assignee: "frontend", depends_on: ["페이지/컴포넌트 구현"] },
     { title: "점진적 검증 (백엔드)", description: "백엔드 구현 후 즉시 검증", assignee: "qa", depends_on: ["라우트 구현"] },
     { title: "점진적 검증 (프론트)", description: "프론트 구현 후 즉시 검증", assignee: "qa", depends_on: ["React Query 훅 작성"] },
     { title: "종합 검증", description: "전체 교차 검증 + 테스트 실행", assignee: "qa", depends_on: ["라우트 등록"] },
     { title: "백엔드 테스트 작성", description: "유닛/통합 테스트", assignee: "backend" },
     { title: "프론트엔드 테스트 작성", description: "컴포넌트 테스트", assignee: "frontend" },
   ])
   ```

   > 작업 목록은 기능의 범위에 따라 조정한다. 단순 API 추가면 프론트 작업을 줄이고, UI 중심이면 백엔드 작업을 줄인다.

### Phase 3: 구현

**실행 방식:** 팀원들이 자체 조율

팀원들은 공유 작업 목록에서 작업을 요청하고 독립적으로 수행한다.
리더는 진행 상황을 모니터링하며 필요 시 개입한다.

**팀원 간 통신 규칙:**
- backend은 API 구현 완료 시 API 응답 shape을 frontend에게 SendMessage로 전달
- frontend은 backend의 API 계약을 받은 후 훅/API 클라이언트 구현 시작
- qa는 각 팀원의 구현이 완료될 때마다 점진적 검증 수행
- qa가 경계면 불일치를 발견하면 해당 팀원에게 SendMessage로 구체적 수정 요청

**산출물 저장:**

| 팀원 | 출력 경로 |
|------|----------|
| backend | `_workspace/api_contract.md` (API 계약) |
| frontend | `_workspace/frontend_routes.md` (라우트 매핑) |
| qa | `_workspace/qa_report.md` (검증 리포트) |

**리더 모니터링:**
- 팀원이 유휴 상태가 되면 자동 알림 수신
- 특정 팀원이 막혔을 때 SendMessage로 지시 또는 작업 재할당
- 전체 진행률은 TaskGet으로 확인

### Phase 4: 통합 검증

1. 모든 팀원의 작업 완료 대기 (TaskGet으로 상태 확인)
2. qa의 종합 검증 리포트 Read
3. FAIL 항목이 있으면 해당 팀원에게 수정 요청
4. 수정 후 재검증
5. 전체 테스트 실행: `bun run test:all && bun run typecheck`

### Phase 5: 정리

1. 팀원들에게 종료 요청 (SendMessage)
2. 팀 정리 (TeamDelete)
3. `_workspace/` 디렉토리 보존 (사후 검증용)
4. 사용자에게 결과 요약 보고:
   - 변경된 파일 목록
   - 추가된 API 엔드포인트
   - 추가된 페이지/컴포넌트
   - 테스트 결과
   - QA 검증 결과

## 데이터 흐름

```
[리더: 분석] → TeamCreate → [backend] ──API 계약──→ [frontend]
                                │                        │
                                ↓                        ↓
                          라우트/서비스/레포          훅/컴포넌트/페이지
                                │                        │
                                └──── [qa: 교차 검증] ────┘
                                           │
                                    qa_report.md
                                           │
                                    [리더: 종합 보고]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| DB 스키마 변경 필요 | Phase 1에서 감지하여 먼저 마이그레이션 생성 (/create-migration) |
| backend 구현 실패 | 리더가 에러 분석 후 재지시 또는 직접 수정 |
| frontend가 API 계약 대기 중 지연 | backend에게 진행 상황 확인 SendMessage |
| qa에서 FAIL 다수 발견 | 심각도 높은 것부터 순서대로 수정 요청 |
| 테스트 실패 | 실패 테스트 로그를 해당 팀원에게 전달하여 수정 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |

## DB 스키마 변경이 필요한 경우

기능이 새 테이블이나 칼럼을 요구하면:

1. Phase 1에서 스키마 변경 필요성을 파악
2. 팀 구성 전에 `/create-migration` 스킬로 마이그레이션 파일 생성
3. `bun run db:migrate`로 스키마 적용
4. 그 후 Phase 2부터 팀 구성 + 구현 진행

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "할일에 우선순위 필드를 추가해줘"라고 요청
2. Phase 1에서 todos 테이블에 priority 칼럼 추가 필요 감지 -> 마이그레이션 생성
3. Phase 2에서 팀 구성 (backend, frontend, qa 3명 + 15개 작업)
4. Phase 3에서 backend가 API 구현 -> frontend에게 계약 전달 -> frontend UI 구현
5. Phase 3에서 qa가 점진적 검증 수행
6. Phase 4에서 종합 검증 통과
7. Phase 5에서 팀 정리 + 결과 보고

### 에러 흐름
1. Phase 3에서 qa가 API 응답의 `priority` 필드가 `number`인데 프론트 타입이 `string`으로 정의된 것을 발견
2. qa가 backend과 frontend 모두에게 SendMessage로 알림
3. 공유 타입을 `number`로 통일하도록 수정 요청
4. backend이 공유 타입 수정, frontend이 UI 표시 로직 수정
5. qa가 재검증 -> PASS
6. Phase 4에서 테스트 전체 통과
