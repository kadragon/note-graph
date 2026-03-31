# AGENTS.md

## [2026-03-31] DB 스키마 변경 시 반드시 migration 실행

- **Problem**: migration history에 applied로 표시되었지만 실제 SQL이 remote DB에 적용되지 않아 런타임 에러 발생 (e.g. `column t.priority does not exist`)
- **Rule**: DB 스키마를 변경하는 코드를 배포할 때 반드시 `bun run deploy:with-migrations` 를 사용하거나, 배포 전 `bun run db:migrate` 를 수동 실행하여 remote DB에 migration이 실제 적용되었는지 확인할 것. `supabase migration repair`로 history만 맞춘 경우 SQL이 실행되지 않으므로 반드시 컬럼 존재 여부를 검증할 것.
- **Why**: repair는 migration history 테이블만 수정하고 실제 DDL을 실행하지 않는다. history가 applied여도 스키마가 변경되지 않을 수 있다.
