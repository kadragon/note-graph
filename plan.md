## WorkNoteService.update: findById 중복 호출 제거

> needsReEmbedding 시 findById가 update 전후로 2회 호출됨. repository.update에 기존 WorkNote를 전달받는 옵션을 추가하여 1회로 줄인다.

- [x] repository.update()가 optional로 previousWorkNote를 받아 내부 findById를 skip하도록 변경
- [x] service.update()에서 needsReEmbedding 시 조회한 previousWorkNote를 repository.update()에 전달
- [x] 기존 테스트 통과 확인
