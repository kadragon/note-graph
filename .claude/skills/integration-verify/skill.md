---
name: integration-verify
description: "note-graph 통합 정합성 검증 스킬. API 응답과 프론트 훅의 경계면 교차 비교, 라우팅 매핑 검증, 타입 일관성 확인을 수행. 백엔드와 프론트엔드를 함께 수정한 후, 통합 검증이 필요할 때, QA를 수행할 때 이 스킬을 사용할 것."
---

# note-graph 통합 정합성 검증 가이드

백엔드 API와 프론트엔드 훅 사이의 경계면을 교차 비교하여, 빌드는 통과하지만 런타임에 실패하는 버그를 사전에 차단한다.

## 왜 교차 비교가 필요한가

TypeScript 제네릭은 런타임 응답 shape을 검증하지 않는다. `this.request<MyItem[]>('/api/items')`에서 실제 API가 `{ items: [...] }`를 반환해도 컴파일은 통과한다. 빌드 성공이 정상 동작을 보장하지 않기 때문에, 양쪽 코드를 동시에 읽고 비교해야 한다.

## 검증 영역

### 1. API 응답 shape ↔ 프론트 훅 타입

**방법:**

1. 변경된 라우트 파일(apps/worker/src/routes/*.ts)에서 `c.json()` 호출부의 응답 데이터 shape 추출
2. 대응하는 API 클라이언트 메서드(apps/web/src/lib/api.ts)에서 `this.request<T>()` 의 T 타입 확인
3. shape과 T가 일치하는지 비교

**주의 패턴:**
- 배열 직접 반환 vs 래핑 객체 `{ items: [] }` 반환
- 서비스에서 추가 가공 후 반환하는 경우 (서비스 반환값 ≠ 레포지토리 반환값)
- `c.json(result.item, 201)` -- result 객체에서 특정 필드만 반환

### 2. snake_case → camelCase 매핑

**방법:**

1. 레포지토리(apps/worker/src/repositories/*.ts)의 SQL에서 `as "camelCase"` alias 확인
2. 공유 타입(packages/shared/types/*.ts)의 인터페이스 필드명과 대조
3. API 클라이언트에서 사용하는 타입과 대조

**이 프로젝트의 규칙:**
- SQL 칼럼: `work_id`, `created_at` (snake_case)
- SQL alias: `work_id as "workId"` (camelCase로 매핑)
- TypeScript: `workId: string` (camelCase)
- alias가 누락되면 프론트에서 `undefined` 접근

### 3. 라우트 경로 매핑

**방법:**

1. 백엔드 라우트 등록(apps/worker/src/index.ts)에서 API 경로 추출
2. API 클라이언트(apps/web/src/lib/api.ts)의 endpoint 문자열과 대조
3. 프론트 라우트(apps/web/src/App.tsx)의 Route path 확인
4. 컴포넌트 내 `navigate()`, `<Link>` 경로가 실제 Route와 매칭되는지 확인

### 4. 공유 타입 일관성

**방법:**

1. packages/shared/types/에 새로 추가/수정된 인터페이스 확인
2. 해당 인터페이스를 import하는 백엔드/프론트엔드 파일에서 사용 방식 확인
3. optional(`?`) vs nullable(`| null`) 구분이 양쪽에서 일관되는지 확인

### 5. 테스트 실행

```bash
# Worker 테스트
bun run test

# Web 테스트
bun run test:web

# 전체
bun run test:all

# 타입 체크
bun run typecheck
```

## 검증 리포트 형식

```markdown
# 통합 정합성 검증 리포트

## 요약
- 검증 항목: N개
- PASS: N개
- FAIL: N개
- SKIP: N개

## 상세

### FAIL: [항목 설명]
- 생산자: [파일:라인] -- [현재 코드]
- 소비자: [파일:라인] -- [현재 코드]
- 수정 방법: [구체적 수정 방법]

### PASS: [항목 설명]
- 확인: [검증 내용]
```

## 점진적 검증 (Incremental QA)

전체 완성 후 1회가 아니라, 각 모듈 완성 직후 검증한다:

1. 백엔드 API 완성 -> 즉시 API 응답 shape 문서화 확인
2. 프론트 훅 완성 -> 즉시 API 응답 shape과 훅 타입 교차 비교
3. 전체 완성 -> 라우팅, 타입, 테스트 종합 검증
