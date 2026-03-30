---
name: frontend-implement
description: "note-graph 프론트엔드 구현 패턴 가이드. React Query 훅, Radix UI 컴포넌트, API 클라이언트, 페이지 구조 패턴을 제공. 프론트엔드 UI를 추가하거나 수정할 때, 훅/컴포넌트/페이지를 만들 때 이 스킬을 사용할 것."
---

# note-graph 프론트엔드 구현 가이드

이 프로젝트의 프론트엔드 구현 패턴을 정의한다. 새 기능을 추가하거나 기존 코드를 수정할 때 이 패턴을 따른다.

## 프로젝트 구조

```
apps/web/src/
├── App.tsx           # 라우터 설정 (lazy-loaded routes)
├── pages/            # 라우트 컴포넌트
│   └── feature/
│       ├── feature.tsx           # 메인 페이지 컴포넌트
│       ├── components/           # 페이지 전용 컴포넌트
│       └── hooks/                # 페이지 전용 훅
├── components/       # 공유 UI 컴포넌트
│   ├── ui/           # Radix UI 기반 프리미티브
│   └── layout/       # 레이아웃 컴포넌트
├── hooks/            # 전역 커스텀 훅 (데이터 패칭)
├── lib/
│   ├── api.ts        # API 클라이언트 (APIClient 클래스)
│   ├── query-keys.ts # React Query 키 팩토리
│   └── query-helpers.ts  # createStandardMutation 등
├── contexts/         # React 컨텍스트 (Supabase auth)
├── types/            # 프론트 전용 타입
└── constants/        # 상수 정의
```

## 1. API 클라이언트 패턴

`apps/web/src/lib/api.ts`의 `APIClient` 클래스에 메서드 추가:

```typescript
// GET 요청
async getMyItems(params?: MyQueryParams, signal?: AbortSignal): Promise<MyItem[]> {
  const searchParams = params ? `?${new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()}` : '';
  return this.request<MyItem[]>(`/my-items${searchParams}`, { signal });
}

// GET 단건
async getMyItem(id: string): Promise<MyItemDetail> {
  return this.request<MyItemDetail>(`/my-items/${id}`);
}

// POST 생성
async createMyItem(data: CreateMyItemRequest): Promise<MyItem> {
  return this.request<MyItem>('/my-items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// PATCH 수정
async updateMyItem(id: string, data: UpdateMyItemRequest): Promise<MyItem> {
  return this.request<MyItem>(`/my-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// DELETE 삭제
async deleteMyItem(id: string): Promise<void> {
  return this.request<void>(`/my-items/${id}`, { method: 'DELETE' });
}
```

## 2. React Query 훅 패턴

### 쿼리 키 (apps/web/src/lib/query-keys.ts)

```typescript
export const qk = {
  myItems: () => ['my-items'] as const,
  myItemDetail: (id: string) => ['my-items', id] as const,
};
```

### 단순 쿼리 훅

```typescript
export function useMyItems() {
  return useQuery({
    queryKey: qk.myItems(),
    queryFn: () => API.getMyItems(),
  });
}

export function useMyItemDetail(id: string | null) {
  return useQuery({
    queryKey: qk.myItemDetail(id!),
    queryFn: () => API.getMyItem(id!),
    enabled: !!id,
  });
}
```

### 표준 뮤테이션 훅 (createStandardMutation 팩토리)

```typescript
export const useCreateMyItem = createStandardMutation({
  mutationFn: (data: CreateMyItemRequest) => API.createMyItem(data),
  invalidateKeys: [qk.myItems()],
  messages: {
    success: '항목이 생성되었습니다.',
    error: '항목을 생성할 수 없습니다.',
  },
});

export const useUpdateMyItem = createStandardMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateMyItemRequest }) =>
    API.updateMyItem(id, data),
  invalidateKeys: (_data, variables) => [
    qk.myItems(),
    qk.myItemDetail(variables.id),
  ],
  messages: { success: '수정되었습니다.', error: '수정할 수 없습니다.' },
});

export const useDeleteMyItem = createStandardMutation({
  mutationFn: (id: string) => API.deleteMyItem(id),
  invalidateKeys: [qk.myItems()],
  messages: { success: '삭제되었습니다.', error: '삭제할 수 없습니다.' },
});
```

### 복잡한 뮤테이션 (직접 useMutation)

```typescript
export function useComplexAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: ComplexParams) => API.complexAction(params),
    onSuccess: (result, variables) => {
      invalidateMany(queryClient, [qk.myItems(), qk.myItemDetail(variables.id)]);
      toast({ title: '성공', description: '작업이 완료되었습니다.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: '오류', description: error.message || '실패했습니다.' });
    },
  });
}
```

## 3. 페이지 컴포넌트 패턴

```typescript
import { Button } from '@web/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMyItems } from '@web/hooks/use-my-items';

export default function MyItemsPage() {
  // 1. 훅 호출
  const { data: items, isLoading, error } = useMyItems();
  const navigate = useNavigate();

  // 2. 파생 상태
  const hasItems = items && items.length > 0;

  // 3. 핸들러
  const handleItemClick = (id: string) => {
    navigate(`/my-items/${id}`);
  };

  // 4. JSX (로딩/에러/성공 분기)
  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">제목</h1>
          <p className="page-description">설명</p>
        </div>
        <Button onClick={() => navigate('/my-items/new')}>새로 만들기</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-destructive">오류가 발생했습니다.</div>
      ) : !hasItems ? (
        <div className="text-muted-foreground text-center py-12">항목이 없습니다.</div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <ItemCard key={item.myId} item={item} onClick={() => handleItemClick(item.myId)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## 4. 라우트 등록 (App.tsx)

```typescript
// lazy import
const MyItemsPage = lazy(() => import('./pages/my-items/my-items'));
const MyItemDetailPage = lazy(() => import('./pages/my-items/detail'));

// Route 등록 (Layout 하위)
<Route path="/my-items" element={<MyItemsPage />} />
<Route path="/my-items/:id" element={<MyItemDetailPage />} />
```

## 5. UI 컴포넌트

Radix UI 기반 컴포넌트 사용 (apps/web/src/components/ui/):
- Button, Input, Textarea, Select, Dialog, Tabs, Popover, Card 등
- Tailwind CSS로 스타일링
- 반응형: `className="flex flex-col gap-4 lg:flex-row"`

## 6. 테스트 패턴

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MyComponent', () => {
  it('renders correctly', async () => {
    renderWithProviders(<MyComponent />);
    expect(await screen.findByText('expected text')).toBeInTheDocument();
  });
});
```

테스트 실행: `bun run test:web`

## 7. 핵심 규칙

- 한국어 UI 텍스트 사용 (toast 메시지, 라벨, placeholder)
- `API` 싱글턴 인스턴스 사용: `import { API } from '@web/lib/api'`
- 아이콘: `lucide-react` 패키지에서 import
- 패키지 매니저: bun 사용 (npx 대신 bunx)
- import 경로: `@web/` alias 사용
