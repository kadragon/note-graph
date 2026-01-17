# NoteGraph Protocol Handler - Uninstallation Script
# Run with: powershell -ExecutionPolicy Bypass -File uninstall.ps1

$ErrorActionPreference = "Stop"

Write-Host "NoteGraph Protocol Handler - Uninstallation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Registry path
$RegPath = "HKCU:\Software\Classes\notegraph"

try {
    if (Test-Path $RegPath) {
        Write-Host "Removing registry keys..." -ForegroundColor Yellow
        Remove-Item -Path $RegPath -Recurse -Force
        Write-Host ""
        Write-Host "Uninstallation completed successfully!" -ForegroundColor Green
        Write-Host "The 'notegraph://' protocol has been unregistered." -ForegroundColor Cyan
    } else {
        Write-Host "Protocol handler is not installed." -ForegroundColor Yellow
    }

    # Also remove log directory (optional)
    $LogDir = Join-Path $env:APPDATA "notegraph-opener"
    if (Test-Path $LogDir) {
        $response = Read-Host "Do you want to remove log files? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Remove-Item -Path $LogDir -Recurse -Force
            Write-Host "Log files removed." -ForegroundColor Green
        }
    }

} catch {
    Write-Host "Error during uninstallation: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "You may need to restart your browser for changes to take effect." -ForegroundColor Yellow
