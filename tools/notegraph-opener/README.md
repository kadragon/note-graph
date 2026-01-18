# NoteGraph Protocol Handler

Windows용 Custom URL Protocol Handler. 웹 브라우저에서 `notegraph://` 링크를 클릭하면 로컬 파일을 열 수 있습니다.

## 설치 방법

### 1. 빌드 (개발자용)

```powershell
cd tools/notegraph-opener
go build -ldflags="-s -w" -o notegraph-opener.exe
```

### 2. 프로토콜 등록

```powershell
# PowerShell에서 실행 (관리자 권한 불필요)
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

### 3. 브라우저 재시작

설치 후 브라우저를 재시작해야 프로토콜이 인식됩니다.

## 사용 방법

웹 페이지에서 다음과 같은 링크를 클릭하면 로컬 파일이 열립니다:

```html
<a href="notegraph://open?path=C%3A%2FGoogleDrive%2FWORK-001%2Fdocument.pdf">
  파일 열기
</a>
```

### URL 형식

```
notegraph://open?path=<url-encoded-path>
```

예시:
- `notegraph://open?path=C%3A%2Ftest.pdf`
- `notegraph://open?path=C%3A%2FGoogle%20Drive%2Ffile.docx`

## 보안

### 허용된 파일 확장자
- 문서: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.hwp`, `.hwpx`, `.txt`, `.rtf`
- 이미지: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`, `.svg`

### 차단된 파일 확장자
- 실행 파일: `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.js`, `.msi`, `.com`, `.scr`, `.pif`, `.reg`

### 보안 기능
- 경로 탈출 공격 방지 (`..` 차단)
- 절대 경로만 허용
- 알 수 없는 확장자 차단

## 로그

로그 파일 위치: `%APPDATA%\notegraph-opener\log.txt`

## 제거

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1
```

## 테스트

```powershell
# 테스트 파일 생성
echo "test" > C:\test.txt

# 프로토콜 테스트
start notegraph://open?path=C%3A%2Ftest.txt
```

## 개발

### 테스트 실행

```powershell
go test ./handler/...
```

### 빌드

```powershell
# 기본 빌드
go build -o notegraph-opener.exe

# 최적화 빌드 (작은 바이너리)
go build -ldflags="-s -w" -o notegraph-opener.exe
```
