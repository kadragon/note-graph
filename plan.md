# Custom Protocol Handler 구현 계획

## 개요

웹에서 버튼 클릭으로 로컬 Google Drive 동기화 폴더의 파일을 직접 실행하기 위한 Custom URL Protocol Handler 구현

**결정 사항:**
- OS: Windows만
- 언어: Go
- 프로토콜: `notegraph://`

**현재 상태:**
- Google Drive 연동 완료 (파일은 Drive에 저장)
- 로컬에 Google Drive 데스크톱 앱으로 동기화 중
- `localDrivePath` 설정으로 로컬 경로 저장 기능 있음

**목표:**
- 웹 UI에서 "파일 열기" 버튼 클릭 → 로컬 파일 실행
- 예: `notegraph://open?path=C:/GoogleDrive/WORK-001/document.pdf` → 로컬 PDF 뷰어 실행

---

## Phase 1: Go 프로토콜 핸들러 개발

### Task 1.1: Go 프로젝트 설정
- [x] `tools/notegraph-opener/` 디렉토리 생성
- [x] `go mod init notegraph-opener`
- [x] 기본 main.go 작성

### Task 1.2: URL 파싱 및 파일 열기
- [x] URL 파싱: `notegraph://open?path=<encoded-path>`
- [x] 경로 디코딩 및 검증
- [x] `os/exec`로 기본 앱에서 파일 열기 (ShellExecute)
- [x] 테스트 작성

### Task 1.3: 보안 검증
- [x] 허용 확장자 화이트리스트 (`.pdf`, `.docx`, `.xlsx`, `.hwp`, `.txt`, `.png`, `.jpg`)
- [x] 실행 파일 차단 (`.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`)
- [x] 경로 탈출 방지 (`..` 차단)

### Task 1.4: 레지스트리 등록
- [x] 설치 스크립트 작성 (install.ps1)
- [x] 제거 스크립트 작성 (uninstall.ps1)

### Task 1.5: 빌드 및 테스트
- [x] 빌드 스크립트 작성 (build.ps1)
- [x] README.md 작성
- [ ] Windows에서 실제 테스트 (수동)

---

## Phase 2: 웹 UI 수정

### Task 2.1: 프로토콜 링크 생성 유틸리티
- [ ] `apps/web/src/lib/protocol-handler.ts` 생성
  ```typescript
  export function buildLocalFileUrl(localDrivePath: string, relativePath: string): string {
    const fullPath = `${localDrivePath}/${relativePath}`;
    return `notegraph://open?path=${encodeURIComponent(fullPath)}`;
  }
  ```

### Task 2.2: 파일 목록 UI 수정
- [ ] `work-note-file-list.tsx` 수정
  - "로컬에서 열기" 버튼 추가 (localDrivePath 설정 시만 표시)
  - 클릭 시 `<a href="notegraph://...">` 또는 `window.location.href` 사용
  - 아이콘: 폴더 열기 또는 외부 링크 아이콘

### Task 2.3: 설정 UI 업데이트
- [ ] 프로토콜 핸들러 설치 안내 추가
- [ ] 다운로드 링크 제공 (GitHub Releases)

---

## Phase 3: 배포

### Task 3.1: GitHub Release
- [ ] `tools/notegraph-opener/` 빌드
- [ ] Release 생성: `notegraph-opener-v1.0.0-windows.zip`
  - `notegraph-opener.exe`
  - `install.ps1`
  - `uninstall.ps1`
  - `README.txt`

### Task 3.2: 설치 가이드 (README.txt)
- [x] 설치 방법 문서화
- [x] 제거 방법 문서화

---

## URL 형식

```
notegraph://open?path=<url-encoded-path>

예시:
notegraph://open?path=C%3A%2FGoogleDrive%2FWORK-001%2Fdocument.pdf
```

## 보안 고려사항

| 항목 | 구현 |
|------|------|
| 허용 확장자 | `.pdf`, `.docx`, `.xlsx`, `.hwp`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.gif` |
| 차단 확장자 | `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.js`, `.msi` |
| 경로 검증 | `..` 포함 시 거부, 절대 경로만 허용 |
| 로깅 | 모든 요청을 `%APPDATA%\notegraph-opener\log.txt`에 기록 |

---

## 파일 구조

```
tools/
└── notegraph-opener/
    ├── go.mod
    ├── main.go
    ├── build.ps1           # 빌드 스크립트
    ├── README.md
    ├── handler/
    │   ├── parser.go       # URL 파싱
    │   ├── parser_test.go
    │   ├── validator.go    # 보안 검증
    │   ├── validator_test.go
    │   ├── opener.go       # 파일 열기
    │   └── logger.go       # 로깅
    └── scripts/
        ├── install.ps1
        └── uninstall.ps1
```

---

## 다음 단계

Phase 2 시작: 웹 UI 수정
