# NoteGraph Protocol Handler - Installation Script
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

Write-Host "NoteGraph Protocol Handler - Installation" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Get the directory where the script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $ScriptDir "notegraph-opener.exe"

# Check if exe exists
if (-not (Test-Path $ExePath)) {
    Write-Host "Error: notegraph-opener.exe not found in $ScriptDir" -ForegroundColor Red
    Write-Host "Please make sure the executable is in the same directory as this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Executable found: $ExePath" -ForegroundColor Green
Write-Host ""

# Registry path (HKCU doesn't require admin rights)
$RegPath = "HKCU:\Software\Classes\notegraph"

try {
    # Create the protocol key
    Write-Host "Creating registry keys..." -ForegroundColor Yellow

    # Create main key
    New-Item -Path $RegPath -Force | Out-Null
    Set-ItemProperty -Path $RegPath -Name "(Default)" -Value "URL:NoteGraph Protocol"
    Set-ItemProperty -Path $RegPath -Name "URL Protocol" -Value ""

    # Create DefaultIcon key (optional, for display)
    $IconPath = "$RegPath\DefaultIcon"
    New-Item -Path $IconPath -Force | Out-Null
    Set-ItemProperty -Path $IconPath -Name "(Default)" -Value "`"$ExePath`",0"

    # Create shell\open\command key
    $CommandPath = "$RegPath\shell\open\command"
    New-Item -Path $CommandPath -Force | Out-Null
    Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value "`"$ExePath`" `"%1`""

    Write-Host ""
    Write-Host "Installation completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The 'notegraph://' protocol is now registered." -ForegroundColor Cyan
    Write-Host "You may need to restart your browser for changes to take effect." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Test by clicking a notegraph:// link or running:" -ForegroundColor Gray
    Write-Host "  start notegraph://open?path=C%3A%2Ftest.txt" -ForegroundColor Gray

} catch {
    Write-Host "Error during installation: $_" -ForegroundColor Red
    exit 1
}
