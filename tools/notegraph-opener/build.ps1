# NoteGraph Protocol Handler - Build Script
# Run with: powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"

Write-Host "NoteGraph Protocol Handler - Build" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Change to project directory
Push-Location $ScriptDir

try {
    # Run tests first
    Write-Host "Running tests..." -ForegroundColor Yellow
    go test ./handler/... -v
    if ($LASTEXITCODE -ne 0) {
        throw "Tests failed"
    }
    Write-Host ""

    # Build
    Write-Host "Building executable..." -ForegroundColor Yellow
    go build -ldflags="-s -w" -o notegraph-opener.exe
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }

    $ExeSize = (Get-Item "notegraph-opener.exe").Length / 1KB
    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Output: notegraph-opener.exe ($([math]::Round($ExeSize, 2)) KB)" -ForegroundColor Gray

    # Create release zip
    Write-Host ""
    Write-Host "Creating release package..." -ForegroundColor Yellow

    $ReleaseDir = "release"
    if (Test-Path $ReleaseDir) {
        Remove-Item $ReleaseDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

    Copy-Item "notegraph-opener.exe" $ReleaseDir
    Copy-Item "scripts/install.ps1" $ReleaseDir
    Copy-Item "scripts/uninstall.ps1" $ReleaseDir

    # Create README.txt for release
    @"
NoteGraph Protocol Handler
===========================

설치 방법:
1. 이 폴더를 원하는 위치에 복사 (예: C:\Program Files\NoteGraph)
2. PowerShell을 열고 다음 명령 실행:
   powershell -ExecutionPolicy Bypass -File install.ps1
3. 브라우저 재시작

제거 방법:
   powershell -ExecutionPolicy Bypass -File uninstall.ps1

자세한 내용은 README.md를 참조하세요.
"@ | Out-File -FilePath "$ReleaseDir/README.txt" -Encoding UTF8

    # Create zip
    $ZipName = "notegraph-opener-windows.zip"
    Compress-Archive -Path "$ReleaseDir/*" -DestinationPath $ZipName -Force

    Write-Host "Release package created: $ZipName" -ForegroundColor Green

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
