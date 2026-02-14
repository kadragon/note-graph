---
name: verify-web-query-consistency
description: 프론트엔드 React Query 키/무효화 공통화와 API query-string 빌더 사용 일관성을 검증합니다. 웹 훅/유틸 리팩터 후 사용.
disable-model-invocation: true
argument-hint: "[선택사항: hooks|api|format]"
---

# Web Query Consistency Verification

## Purpose

1. React Query 키가 `qk` 팩토리를 통해 일관되게 사용되는지 검증합니다.
2. 반복 무효화 로직이 `invalidateMany`/`workNoteRelatedKeys`로 통합되었는지 검증합니다.
3. 반복 규칙/날짜 포맷 유틸이 중복 없이 재사용되는지 검증합니다.
4. API 클라이언트에서 query-string 생성이 `buildQueryString` 중심으로 유지되는지 검증합니다.

## When to Run

- `apps/web/src/hooks`의 mutation/query 로직을 수정한 후
- `apps/web/src/lib/api.ts`의 쿼리 파라미터 코드를 수정한 후
- 날짜/반복 규칙 표시 로직을 추가/변경한 후
- 프론트엔드 리팩터 완료 후 PR 전에

## Related Files

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/query-keys.ts` | React Query 키 팩토리 |
| `apps/web/src/lib/query-invalidation.ts` | 공통 invalidation helper |
| `apps/web/src/lib/todo-repeat-rule.ts` | 반복 규칙 라벨 공통 유틸 |
| `apps/web/src/lib/date-format.ts` | 날짜 포맷 공통 유틸 |
| `apps/web/src/lib/api.ts` | API query-string 빌더 |
| `apps/web/src/hooks/use-todos.ts` | TODO optimistic update + invalidation |
| `apps/web/src/hooks/use-work-notes.ts` | work-note 관련 query/mutation |
| `apps/web/src/hooks/use-pdf.ts` | PDF mutation invalidation |
| `apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx` | 다이얼로그 query key/포맷 유틸 사용 |
| `apps/web/src/lib/api.test.ts` | API URL/query-string 회귀 검증 |

## Workflow

### Step 1: Query key factory usage

**Tool:** Grep  
**Check:** 대상 훅/컴포넌트에서 리터럴 query key 대신 `qk`를 사용해야 합니다.

```bash
rg -n "queryKey:\\s*\\[" apps/web/src/hooks/use-todos.ts apps/web/src/hooks/use-work-notes.ts apps/web/src/hooks/use-pdf.ts apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx
```

PASS: 결과가 없거나 테스트/예외 파일만 해당.  
FAIL: 운영 코드에서 `queryKey: ['...']` 리터럴이 직접 사용됨.  
Fix: `apps/web/src/lib/query-keys.ts`에 키를 추가하고 호출부를 `qk.*()`로 교체.

### Step 2: Common invalidation helper usage

**Tool:** Grep  
**Check:** 반복 invalidation 루프 대신 `invalidateMany`/`workNoteRelatedKeys`를 사용해야 합니다.

```bash
rg -n "invalidateQueries\\(|findAll\\(\\{ queryKey" apps/web/src/hooks/use-todos.ts apps/web/src/hooks/use-work-notes.ts apps/web/src/hooks/use-pdf.ts apps/web/src/hooks/use-ai-draft-form.ts apps/web/src/hooks/use-enhance-work-note.ts apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx
```

PASS: 수동 invalidate 호출이 불가피한 케이스를 제외하고 helper 경로가 사용됨.  
FAIL: 같은 키 셋을 순회/중복 호출하는 코드가 새로 생김.  
Fix: `invalidateMany(queryClient, workNoteRelatedKeys(...))` 또는 `invalidateMany(queryClient, [qk...])`로 통합.

### Step 3: Repeat-rule/date format utility reuse

**Tool:** Grep  
**Check:** 화면별 로컬 매핑/로컬 날짜 포맷 함수가 재도입되지 않아야 합니다.

```bash
rg -n "repeatRuleLabels|const\\s+formatDate|new Intl\\.DateTimeFormat\\(" apps/web/src/pages/dashboard/components/todo-item.tsx apps/web/src/pages/work-notes/components/recurring-todo-group.tsx apps/web/src/pages/ai-logs/ai-logs.tsx apps/web/src/pages/work-notes/components/view-work-note-dialog.tsx apps/web/src/lib/pdf/work-note-pdf-document.tsx
```

PASS: `getTodoRepeatRuleLabel`/`formatDateTimeOrFallback`/`formatDateTimeInKstOrFallback` 사용.  
FAIL: 동일 책임 로컬 helper/맵이 다시 정의됨.  
Fix: 공통 유틸 import로 교체하고 로컬 정의 삭제.

### Step 4: API query-string builder consistency

**Tool:** Grep + Read  
**Check:** `apps/web/src/lib/api.ts`에서 `new URLSearchParams()` 직접 사용은 `buildQueryString` 내부에만 남아야 합니다.

```bash
rg -n "new URLSearchParams\\(" apps/web/src/lib/api.ts
```

PASS: 1건(`buildQueryString` 내부)만 존재.  
FAIL: 개별 API 메서드에 직접 `URLSearchParams`가 다시 추가됨.  
Fix: 해당 메서드를 `this.buildQueryString(...)` 기반으로 재작성.

### Step 5: Regression test coverage

**Tool:** Bash  
**Check:** query-string/공통 유틸 테스트가 유지되어야 합니다.

```bash
bunx vitest --run apps/web/src/lib/api.test.ts apps/web/src/lib/query-keys.test.ts apps/web/src/lib/query-invalidation.test.ts apps/web/src/lib/todo-repeat-rule.test.ts apps/web/src/lib/date-format.test.ts
```

PASS: 모든 테스트 통과.  
FAIL: URL 인코딩/파라미터 순서/폴백 처리 회귀 발생.  
Fix: 구현과 테스트 기대값을 비교해 기존 동작과 맞추고 재실행.

## Output Format

```markdown
## verify-web-query-consistency

| Check | Status | Evidence | Action |
| --- | --- | --- | --- |
| Query key factory usage | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Common invalidation helper usage | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Utility reuse | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| API query-string builder consistency | PASS/FAIL | `file:line` or command output | 필요한 수정 |
| Regression test coverage | PASS/FAIL | test summary | 필요한 수정 |
```

## Exceptions

1. 테스트 파일에서의 리터럴 query key는 의도적 검증 목적이면 허용합니다.
2. `queryClient.cancelQueries`는 optimistic update 안전성 때문에 수동 호출을 허용합니다.
3. `new URLSearchParams()`는 `buildQueryString` 내부 구현 1회 사용은 정상입니다.

