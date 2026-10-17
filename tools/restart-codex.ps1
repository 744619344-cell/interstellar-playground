#requires -Version 5.1
<# Default: inspect only. -Restart: close and relaunch this user's packaged desktop app. #>
[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Restart, [switch]$CheckOnly, [ValidateRange(0, 60)][int]$DelaySeconds = 8)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
. (Join-Path $PSScriptRoot 'codex-restart-core.ps1')

function Get-CodexDesktopTarget {
    $package = @(Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1)
    if ($package.Count -ne 1) { throw 'CodexDesktopPackageNotFound' }
    $manifest = Get-AppxPackageManifest -Package $package[0].PackageFullName
    $target = ConvertTo-CodexRestartTarget $package[0] @($manifest.Package.Applications.Application)
    if (-not (Test-Path -LiteralPath $target.ExecutablePath -PathType Leaf)) { throw 'DesktopExecutableMissing' }
    $target
}

function Get-LocalPreviewStatus {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:5173/' -Method Head -UseBasicParsing -TimeoutSec 3
        return [int]$response.StatusCode
    } catch { return 0 }
}

$readProcesses = { param($target) Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe' OR Name = 'Codex.exe'" }
$lock = $null; $ownsLock = $false; $logFile = $null; $exitCode = 0
try {
    if ($env:OS -ne 'Windows_NT') { throw 'WindowsRequired' }
    $target = Get-CodexDesktopTarget
    $processes = @(Get-CodexRestartProcesses $target $readProcesses)
    Write-Host ('Target: ' + $target.AppId)
    Write-Host ('Matching app processes: ' + $processes.Count)
    Write-Host ('Local preview HTTP status (0 = unavailable): ' + (Get-LocalPreviewStatus))
    if ($CheckOnly -or -not $Restart) {
        Write-Host 'CHECK ONLY: nothing was closed, launched, installed or changed.'
        exit 0
    }
    if (-not $PSCmdlet.ShouldProcess('ChatGPT / Codex desktop app', 'Close app windows and relaunch')) { exit 0 }
    $lock = Enter-CodexRestartGuard
    $ownsLock = $true
    Write-Host 'Restart closes every window of this desktop app and may interrupt running tasks.'
    Write-Host 'Saved project files are kept. Press Ctrl+C during the countdown to cancel.'
    for ($seconds = $DelaySeconds; $seconds -gt 0; $seconds--) {
        Write-Host ('Restart in ' + $seconds + ' seconds...'); Start-Sleep -Seconds 1
    }
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $logDirectory = Join-Path $projectRoot '.cache\codex-restart'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $logFile = Join-Path $logDirectory ('restart-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID + '.log')
    $log = {
        param($eventName, $count)
        $line = (Get-Date -Format 'o') + ' ' + $eventName + ' ' + $count
        Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
        Write-Host $line
    }.GetNewClosure()
    $operations = @{
        Read = $readProcesses
        Log = $log
        Wait = { Start-Sleep -Milliseconds 500 }
        Close = {
            param($item, $target)
            $verified = Get-VerifiedCodexRestartProcess $item $target
            if ($verified) {
                $gui = Get-Process -Id $verified.ProcessId -ErrorAction SilentlyContinue
                if ($gui -and $gui.MainWindowHandle -ne [IntPtr]::Zero) { [void]$gui.CloseMainWindow() }
            }
        }
        Stop = {
            param($item, $target)
            $verified = Get-VerifiedCodexRestartProcess $item $target
            if ($verified) { Stop-Process -Id $verified.ProcessId -ErrorAction Stop }
        }
        Launch = {
            param($target)
            Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('shell:AppsFolder\' + $target.AppId) -WindowStyle Hidden
        }
    }
    $result = Invoke-CodexRestartWorkflow $target $operations
    & $log 'preview-http-after-restart' (Get-LocalPreviewStatus)
    Write-Host ('Result: ' + $result.Result + '. Browser control must be tested separately.')
    Write-Host 'Logs: .cache\codex-restart\'
} catch {
    $exitCode = 1
    if ($logFile) { Add-Content -LiteralPath $logFile -Value ('failed ' + $_.FullyQualifiedErrorId) -Encoding UTF8 }
    Write-Host ('Restart failed: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    if ($ownsLock) { $lock.ReleaseMutex() }
    if ($lock) { $lock.Dispose() }
}
exit $exitCode
