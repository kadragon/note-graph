---
name: backend-implement
description: "note-graph 백엔드 구현 패턴 가이드. Hono 라우트, 서비스, 레포지토리, Zod 스키마, 미들웨어 패턴을 제공. 백엔드 API를 추가하거나 수정할 때, worker 코드를 작성할 때, 라우트/서비스/레포지토리를 만들 때 이 스킬을 사용할 것."
---

# note-graph 백엔드 구현 가이드

이 프로젝트의 백엔드 구현 패턴을 정의한다. 새 기능을 추가하거나 기존 코드를 수정할 때 이 패턴을 따른다.

## 프로젝트 구조

```
apps/worker/src/
├── index.ts          # Hono 앱 초기화, 라우트 등록
├── routes/           # API 라우트 핸들러
├── services/         # 비즈니스 로직
├── repositories/     # DB 접근 레이어
├── schemas/          # Zod 검증 스키마
├── middleware/       # 인증, 검증, 레포지토리 주입
├── handlers/         # 특수 요청 핸들러
├── adapters/         # DB 팩토리, 커넥션 풀링
├── utils/            # 유틸리티 함수
└── types/            # 컨텍스트, 환경, 에러 타입
```

## 1. 라우트 패턴

라우터 생성 → 미들웨어 체이닝 → 서비스 인스턴스화 → 응답 반환:

```typescript
import { createProtectedRouter } from '../middleware/router-factory';
import { bodyValidator, getValidatedBody, queryValidator, getValidatedQuery } from '../middleware/validation';
import { mySchema, myQuerySchema } from '../schemas/my-schema';

const myRoutes = createProtectedRouter<MyContext>();

// 목록 조회
myRoutes.get('/', queryValidator(myQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof myQuerySchema>(c);
  const service = new MyService(c.get('db'), c.env, c.get('settingService'));
  const results = await service.findAll(query);
  return c.json(results);
});

// 단건 조회
myRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const service = new MyService(c.get('db'), c.env);
  const item = await service.findById(id);
  if (!item) return notFoundJson(c, 'Item', id);
  return c.json(item);
});

// 생성
myRoutes.post('/', bodyValidator(mySchema), async (c) => {
  const data = getValidatedBody<typeof mySchema>(c);
  const service = new MyService(c.get('db'), c.env);
  const result = await service.create(data);
  // 비동기 후처리가 있으면 waitUntil 사용
  if (result.backgroundPromise) {
    c.executionCtx.waitUntil(result.backgroundPromise);
  }
  return c.json(result.item, 201);
});

// 수정
myRoutes.patch('/:id', bodyValidator(updateSchema), async (c) => {
  const id = c.req.param('id');
  const data = getValidatedBody<typeof updateSchema>(c);
  const service = new MyService(c.get('db'), c.env);
  const updated = await service.update(id, data);
  return c.json(updated);
});

// 삭제
myRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const service = new MyService(c.get('db'), c.env);
  await service.delete(id);
  return c.body(null, 204);
});

export { myRoutes };
```

라우트 등록은 `apps/worker/src/index.ts`에서:
```typescript
app.route('/api/my-resource', myRoutes);
```

## 2. 서비스 패턴

클래스 기반. 생성자에서 의존성 주입, 메서드에서 비즈니스 로직:

```typescript
export class MyService {
  private repository: MyRepository;

  constructor(db: DatabaseClient, env: Env, settingService?: SettingService) {
    this.repository = new MyRepository(db);
  }

  async findAll(query: ListMyQuery): Promise<MyItem[]> {
    return this.repository.findAll(query);
  }

  async create(data: CreateMyInput): Promise<{ item: MyItem; backgroundPromise?: Promise<void> }> {
    const item = await this.repository.create(data);
    return { item };
  }
}
```

에러 로깅 패턴: `console.error('[ServiceName] message:', { context })`

## 3. 레포지토리 패턴

DB 쿼리 캡슐화. SQL alias로 snake_case → camelCase 매핑:

```typescript
export class MyRepository {
  constructor(private db: DatabaseClient) {}

  private generateId(): string {
    return `PREFIX-${nanoid()}`;
  }

  async findById(id: string): Promise<MyItem | null> {
    return this.db.queryOne<MyItem>(
      `SELECT my_id as "myId", title, created_at as "createdAt"
       FROM my_table WHERE my_id = $1`,
      [id]
    );
  }

  async findAll(query: ListMyQuery): Promise<MyItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.q) {
      conditions.push(`search_vector @@ plainto_tsquery('simple', $${paramIndex})`);
      params.push(query.q);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query<MyItem>(
      `SELECT my_id as "myId", title FROM my_table ${where} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  }

  async create(data: CreateMyInput): Promise<MyItem> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const statements = [
      {
        sql: `INSERT INTO my_table (my_id, title, created_at, updated_at) VALUES ($1, $2, $3, $3)`,
        params: [id, data.title, now],
      },
    ];
    await this.db.executeBatch(statements);
    return { myId: id, title: data.title, createdAt: now };
  }
}
```

DB 헬퍼 메서드:
- `this.db.queryOne<T>(sql, params)` -- 단건 또는 null
- `this.db.query<T>(sql, params)` -- `{ rows: T[] }`
- `this.db.execute(sql, params)` -- `{ rowCount: number }`
- `this.db.executeBatch(statements)` -- 다중 문 원자적 실행
- `queryInChunks(db, ids, callback)` -- IN 절 청크 처리

## 4. Zod 스키마 패턴

```typescript
import { z } from 'zod';

export const createMySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  category: z.enum(['A', 'B', 'C']).optional(),
  relatedIds: z.array(z.string()).optional(),
});

export const updateMySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

export const listMyQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  from: z.string().datetime({ message: 'from must be a valid ISO 8601 date-time string' }).optional(),
  to: z.string().datetime({ message: 'to must be a valid ISO 8601 date-time string' }).optional(),
});

// 타입 추출
export type CreateMyInput = z.infer<typeof createMySchema>;
export type UpdateMyInput = z.infer<typeof updateMySchema>;
export type ListMyQuery = z.infer<typeof listMyQuerySchema>;
```

## 5. 공유 타입 패턴

packages/shared/types/에 인터페이스 정의:

```typescript
export interface MyItem {
  myId: string;        // PREFIX-{nanoid}
  title: string;
  description: string | null;  // nullable
  category?: string;           // optional
  createdAt: string;           // ISO 8601
  updatedAt: string;
}
```

## 6. 테스트 패턴

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    vi.restoreAllMocks();
    // setup
  });

  it('creates item with generated ID', async () => {
    const result = await service.create({ title: 'Test' });
    expect(result.item.myId).toMatch(/^PREFIX-/);
    expect(result.item.title).toBe('Test');
  });
});
```

테스트 실행: `bun run test` (worker), `bun run test:web` (web)

## 7. 핵심 규칙

- `createProtectedRouter`는 인증 + 에러 핸들링 미들웨어를 자동 적용한다
- 레포지토리를 직접 사용하지 않고 미들웨어가 주입한 것을 쓸 수 있다: `c.get('repositories').todos`
- 비차단 후처리는 `c.executionCtx.waitUntil(promise)` 사용
- 사용자 정보: `getAuthUser(c)` -> `{ email, id }`
- 응답 헬퍼: `notFoundJson(c, 'Entity', id)`, `missingParamJson(c, 'param')`
- 패키지 매니저: bun 사용 (npx 대신 bunx)
