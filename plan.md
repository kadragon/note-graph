## Phase 1: Quick Wins

### 1.1 Alias Remapping 제거 - Double-Quoted Identifiers 사용

> SQL alias에 double-quote를 적용하여 PostgreSQL이 대소문자를 보존하게 하고, buildAliasMap/remapRowKeys 레이어를 제거한다.

- [x] 모든 repository/service/route SQL alias에 double-quote 적용
- [x] supabase-database-client에서 buildAliasMap, remapRowKeys, stripQuotedContexts 제거
- [x] alias remap 관련 테스트 제거/수정

### 1.2 findByIdWithDetails() - findById를 Promise.all에 병합

> 6개 쿼리 모두를 하나의 Promise.all로 실행하여 2단계 순차 실행을 1단계로 줄인다.

- [x] findByIdWithDetails()에서 findById를 Promise.all에 병합

### 1.3 Meeting Minutes findPaginated() - COUNT(*) OVER() Window Function

> COUNT 쿼리와 DATA 쿼리를 단일 쿼리로 통합한다.

- [x] Meeting minutes findPaginated()에 COUNT(*) OVER() 적용

### 1.4 Partial Index - Pending Embeddings

> embedded_at IS NULL 조건의 partial index를 추가한다.

- [x] Partial index migration 추가

## Phase 2: Core Improvements

### 2.1 executeBatch 파이프라이닝

> postgres.js 네이티브 트랜잭션 API를 활용하여 파이프라이닝을 지원한다.

- [x] SupabaseConnection에 트랜잭션 API 노출, executeBatch 파이프라이닝

### 2.2 Multi-Row VALUES INSERT

> 동일 테이블 INSERT를 multi-row VALUES로 병합하는 헬퍼를 구현한다.

- [x] Multi-row VALUES insert helper 구현 및 적용

### 2.3 findByIdWithDetails() - JSON Aggregation 단일 쿼리

> LEFT JOIN LATERAL + json_agg로 6개 쿼리를 단일 쿼리로 통합한다.

- [x] findByIdWithDetails() LATERAL + json_agg 단일 쿼리로 재작성

### 2.4 findAll() - JSON Aggregation 단일 쿼리

> LATERAL + json_agg + COUNT(*) OVER()로 4개 쿼리를 단일 쿼리로 통합한다.

- [x] findAll() LATERAL + json_agg + COUNT(*) OVER() 단일 쿼리로 재작성

## Phase 3: Refinements

### 3.1 Statistics - 단일 CTE + JSON Aggregation

> 3+ 쿼리를 CTE + LATERAL json_agg 단일 쿼리로 통합한다.

- [x] Statistics repository 단일 CTE + JSON aggregation 재작성

### 3.2 Junction 테이블 업데이트 - UPSERT 패턴

> DELETE + 재INSERT 패턴을 DELETE WHERE NOT IN + INSERT ON CONFLICT로 전환한다.

- [x] Junction 업데이트 UPSERT 패턴 전환 (migration + repository)

### 3.3 Covering Index for Todos

> 활성 할일을 위한 covering index를 추가한다.

- [x] Covering index migration 추가
