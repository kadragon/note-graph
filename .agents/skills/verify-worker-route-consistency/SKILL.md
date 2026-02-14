---
name: verify-worker-route-consistency
description: Worker 라우트의 공통 helper 재사용, NotFoundError 일관성, query schema 검증 경로를 점검합니다. 라우트/스키마 리팩터 후 사용.
disable-model-invocation: true
argument-hint: "[선택사항: routes|schemas|tests]"
---

# Worker Route Consistency Verification

## Purpose

1. 중복 라우트 helper가 공통 모듈로 유지되는지 검증합니다.
2. Not Found 응답이 `NotFoundError` 기반으로 일관되게 처리되는지 검증합니다.
3. 라우트 query 파싱이 schema validator 중심으로 유지되는지 검증합니다.
4. 관련 단위/통합 테스트가 구조 변경을 계속 커버하는지 검증합니다.

## When to Run

- `apps/worker/src/routes` 파일을 수정한 후
- `apps/worker/src/schemas` query 스키마를 수정한 후
- 에러 응답 형식(`NOT_FOUND` 등)을 건드린 후
- worker 리팩터 후 PR 전에

## Related Files

| File | Purpose |
| --- | --- |
| `apps/worker/src/routes/shared/reembed.ts` | 공통 re-embed helper |
| `apps/worker/src/routes/todos.ts` | todo 라우트에서 shared helper 사용 |
| `apps/worker/src/routes/work-notes.ts` | work-note 라우트에서 shared helper/NotFoundError 사용 |
| `apps/worker/src/routes/persons.ts` | person not-found 처리 |
| `apps/worker/src/routes/task-categories.ts` | task-category not-found 처리 |
| `apps/worker/src/routes/admin.ts` | admin query schema validator 사용 |
| `apps/worker/src/routes/meeting-minutes.ts` | meeting-minute list query schema validator 사용 |
| `apps/worker/src/schemas/admin.ts` | admin query schema |
| `apps/worker/src/schemas/meeting-minute.ts` | meeting-minute list query schema |
| `tests/unit/reembed-route-helper.test.ts` | shared helper 동작 검증 |
| `tests/unit/schemas.test.ts` | admin/meeting-minute schema 검증 |

## Workflow

### Step 1: Re-embed helper de-duplication

**Tool:** Grep  
**Check:** `triggerReembed` 중복 구현이 라우트 파일에 재등장하면 안 됩니다.

```bash
rg -n "function\\s+triggerReembed" apps/worker/src/routes
```

PASS: `apps/worker/src/routes/shared/reembed.ts` 외 결과 없음.  
FAIL: 라우트 파일에 로컬 `triggerReembed` 구현이 존재.  
Fix: 로컬 구현 삭제 후 `from './shared/reembed'` import로 통합.

### Step 2: Shared helper wiring

**Tool:** Grep  
**Check:** todo/work-note 라우트가 shared helper를 실제로 import/use 해야 합니다.

```bash
rg -n "from './shared/reembed'|triggerReembed\\(" apps/worker/src/routes/todos.ts apps/worker/src/routes/work-notes.ts
```

PASS: 두 파일 모두 import와 호출이 확인됨.  
FAIL: import 누락, 혹은 호출이 제거되어 비동기 re-embed가 깨짐.  
Fix: `c.executionCtx.waitUntil(triggerReembed(...))` 호출을 복구.

### Step 3: NotFoundError consistency

**Tool:** Grep  
**Check:** 대상 라우트에서 inline 404 JSON 대신 `NotFoundError`를 사용해야 합니다.

```bash
rg -n "code:\\s*'NOT_FOUND'|not found" apps/worker/src/routes/persons.ts apps/worker/src/routes/task-categories.ts apps/worker/src/routes/work-notes.ts
```

PASS: `throw new NotFoundError(...)` 경로만 존재.  
FAIL: 수동 `c.json(..., 404)` 패턴이 재도입됨.  
Fix: `NotFoundError`를 throw하고 공통 error handler로 응답 생성을 위임.

### Step 4: Query schema validator consistency

**Tool:** Grep  
**Check:** admin/meeting-minute 라우트는 query schema + `getValidatedQuery`를 사용해야 합니다.

```bash
rg -n "queryValidator\\(adminBatchQuerySchema\\)|queryValidator\\(adminEmbeddingFailuresQuerySchema\\)|getValidatedQuery<" apps/worker/src/routes/admin.ts
rg -n "queryValidator\\(listMeetingMinutesQuerySchema\\)|getValidatedQuery<" apps/worker/src/routes/meeting-minutes.ts
```

PASS: schema validator + typed query extraction이 모두 존재.  
FAIL: `c.req.query()` 기반 수동 파싱 회귀.  
Fix: 대응 schema를 추가/사용하고 라우트에서 `getValidatedQuery`로 교체.

### Step 5: Focused regression tests

**Tool:** Bash  
**Check:** helper/schema 관련 핵심 테스트가 통과해야 합니다.

```bash
bunx vitest --run tests/unit/reembed-route-helper.test.ts tests/unit/schemas.test.ts tests/integration/admin-embedding-failures.test.ts tests/integration/meeting-minutes-routes.test.ts
```

PASS: 모두 통과.  
FAIL: helper 호출/에러 핸들링 또는 schema 기본값/검증 회귀.  
Fix: 실패 테스트 기준으로 라우트/스키마를 최소 수정 후 재실행.

## Output Format

```markdown
## verify-worker-route-consistency

| Check | Status | Evidence | Action |
| --- | --- | --- | --- |
| Re-embed helper de-duplication | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Shared helper wiring | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| NotFoundError consistency | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Query schema validator consistency | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Focused regression tests | PASS/FAIL | test summary | 필요한 수정 |
```

## Exceptions

1. `work-notes` 라우트의 파일 업로드 실패(400 BAD_REQUEST) 같은 비-404 에러는 `NotFoundError` 대상이 아닙니다.
2. 테스트 더블/목킹 코드에서의 수동 에러 객체 문자열은 production 에러 흐름 위반이 아닙니다.
3. 신규 라우트가 아직 schema 도입 전 PoC 단계인 경우, PR 전까지 validator 추가 계획이 명시되면 일시 허용할 수 있습니다.

