# 배포 가이드

> Worknote Management System을 Cloudflare Workers에 배포하는 방법을 안내합니다.

## 사전 준비

### 1. Cloudflare 계정 및 도메인

- Cloudflare 계정 (무료 플랜 가능)
- 등록된 도메인 (Cloudflare DNS로 관리)
- Workers 유료 플랜 (권장, Queue 사용 시 필수)

### 2. Wrangler 설정

```bash
# Wrangler 설치
npm install -g wrangler

# 로그인
wrangler login

# Account ID 확인
wrangler whoami
```

---

## 배포 단계

### 1. 프로덕션 리소스 생성

```bash
# D1 데이터베이스
wrangler d1 create worknote-db

# Vectorize 인덱스
wrangler vectorize create worknote-vectors --dimensions=1536 --metric=cosine

# R2 버킷
wrangler r2 bucket create worknote-pdf-temp
wrangler r2 bucket create worknote-files

# Queue
wrangler queues create pdf-processing-queue
```

### 2. wrangler.toml 업데이트

생성한 리소스 ID를 `wrangler.toml`에 입력:

```toml
[[d1_databases]]
binding = "DB"
database_name = "worknote-db"
database_id = "YOUR_DATABASE_ID"

[[vectorize]]
binding = "VECTORIZE"
index_name = "worknote-vectors"

[[r2_buckets]]
binding = "PDF_BUCKET"
bucket_name = "worknote-pdf-temp"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "worknote-files"

[[queues.producers]]
binding = "PDF_QUEUE"
queue = "pdf-processing-queue"

[vars]
AI_GATEWAY_ID = "worknote-maker"
```

### 3. Secrets 설정

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put OPENAI_API_KEY
```

### 4. 데이터베이스 마이그레이션

```bash
npm run db:migrate
```

### 5. 프론트엔드 빌드

```bash
npm run build:frontend
```

### 6. Workers 배포

```bash
npm run deploy
```

---

## Cloudflare Access 설정

### 1. Application 생성

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. "Add an application" 클릭
3. "Self-hosted" 선택
4. 설정:
   - Application name: `Worknote Management`
   - Session Duration: `24 hours`
   - Application domain: `worknote.yourdomain.com`

### 2. Identity Provider 설정

1. Zero Trust → Settings → Authentication
2. "Add new" → Google 선택
3. Google OAuth 설정 (Client ID, Secret)

### 3. Access Policy

Allow 정책 추가:
- Name: `Authorized Users`
- Action: `Allow`
- Rule: `Emails` → 허용할 이메일 주소 입력

---

## 도메인 설정

### 1. DNS 레코드

Cloudflare DNS에서:

```
Type: CNAME
Name: worknote (또는 원하는 서브도메인)
Target: <your-worker>.workers.dev
Proxy: Enabled (오렌지 클라우드)
```

### 2. Routes 설정

`wrangler.toml`에 추가:

```toml
[env.production]
name = "worknote-management"
route = "worknote.yourdomain.com/*"
```

재배포:
```bash
wrangler deploy --env production
```

---

## 모니터링

### 1. Workers Analytics

Cloudflare Dashboard → Workers → worknote-management → Metrics

확인 가능한 지표:
- 요청 수
- 오류율
- CPU 사용 시간
- 지역별 요청 분포

### 2. Logs

실시간 로그:
```bash
wrangler tail
```

특정 필터:
```bash
wrangler tail --status error
```

### 3. AI Gateway Analytics

Cloudflare Dashboard → AI → AI Gateway → worknote-maker

확인 가능한 지표:
- API 호출 수
- 비용
- 모델별 사용량
- 캐시 히트율

---

## 백업

### D1 백업

```bash
# 백업
wrangler d1 export worknote-db --output=backup-$(date +%Y%m%d).sql

# 복원
wrangler d1 execute worknote-db --file=backup-20251201.sql
```

### R2 백업

R2는 자동 복제 및 내구성 제공 (11 nines)

수동 백업:
```bash
wrangler r2 object get worknote-files/path/to/file --file=local-backup
```

---

## 롤백

### Workers 롤백

```bash
# 이전 버전으로 롤백
wrangler rollback
```

### 데이터베이스 롤백

```bash
# 백업에서 복원
wrangler d1 execute worknote-db --file=backup-previous.sql
```

---

## 문제 해결

### 배포 실패

```bash
# 상세 로그 확인
wrangler deploy --verbose

# 빌드 정리 후 재시도
rm -rf dist
npm run build
wrangler deploy
```

### Access 오류

- Application Domain 확인
- DNS 프록시 활성화 확인
- Identity Provider 설정 확인

### 성능 문제

- Workers Analytics에서 병목 확인
- D1 쿼리 최적화 (인덱스)
- Vectorize 필터 활용

---

## 유지보수

### 정기 작업

1. **주간**: Workers Analytics 모니터링
2. **월간**: AI Gateway 비용 확인
3. **분기**: D1 백업
4. **연간**: Access Policy 검토

### 업데이트 프로세스

1. 로컬 테스트
2. 스테이징 배포 (선택)
3. 프로덕션 배포
4. 모니터링
5. 롤백 준비

---

**마지막 업데이트**: 2025-12-01
