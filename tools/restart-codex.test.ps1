#requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'codex-restart-core.ps1')
$script:passed = 0
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) 'codex-restart-fixture'
$package = [pscustomobject]@{ Name = 'OpenAI.Codex'; PackageFamilyName = 'OpenAI.Codex_test123'; InstallLocation = $fixtureRoot }
$target = ConvertTo-CodexRestartTarget $package @([pscustomobject]@{ Id = 'App'; Executable = 'app/ChatGPT.exe' })

function Assert-True($Value, $Message) { if (-not $Value) { throw $Message } }
function Assert-Equal($Actual, $Expected, $Message) { if ($Actual -ne $Expected) { throw $Message } }
function Assert-Throws([scriptblock]$Body, [string]$Message) {
    $caught = $false
    try { & $Body | Out-Null } catch { $caught = $true; Assert-True ($_.Exception.Message -like ('*' + $Message + '*')) 'Wrong failure' }
    Assert-True $caught 'Expected an explicit failure'
}
function Test-Case([string]$Name, [scriptblock]$Body) {
    & $Body; $script:passed++; Write-Host ('PASS ' + $Name)
}
function New-FixtureProcess([int]$Number, [string]$Path) {
    [pscustomobject]@{ ProcessId = $Number; ExecutablePath = $Path; CreationDate = [datetime]'2026-01-01'; SessionId = $target.SessionId }
}
function New-FakeRestart([bool]$Graceful = $false, [bool]$Unstoppable = $false, [bool]$Starts = $true) {
    $state = @{ Rows = @((New-FixtureProcess 11 $target.ExecutablePath), (New-FixtureProcess 23 (Join-Path $fixtureRoot 'other/ChatGPT.exe')));
        Closed = @(); Stopped = @(); Launches = 0; Waits = 0; Events = @() }
    $operations = @{
        Read = { param($t) $state.Rows }.GetNewClosure()
        Close = { param($p, $t) $state.Closed += $p.ProcessId; if ($Graceful) { $state.Rows = @($state.Rows | Where-Object { $_.ProcessId -ne $p.ProcessId }) } }.GetNewClosure()
        Stop = { param($p, $t) $state.Stopped += $p.ProcessId; if (-not $Unstoppable) { $state.Rows = @($state.Rows | Where-Object { $_.ProcessId -ne $p.ProcessId }) } }.GetNewClosure()
        Launch = { param($t) $state.Launches++; if ($Starts) { $state.Rows += [pscustomobject]@{ ProcessId = 99; ExecutablePath = $t.ExecutablePath; CreationDate = [datetime]'2026-02-01'; SessionId = $t.SessionId } } }.GetNewClosure()
        Wait = { $state.Waits++ }.GetNewClosure()
        Log = { param($name, $count) $state.Events += $name }.GetNewClosure()
    }
    @{ State = $state; Operations = $operations }
}
function Run-Fake($Fake) { Invoke-CodexRestartWorkflow $target $Fake.Operations -ExitPolls 2 -LaunchPolls 3 }

Test-Case 'manifest selects only the main app and builds a version-independent activation ID' {
    Assert-Equal $target.AppId 'OpenAI.Codex_test123!App' 'Wrong activation ID'
    Assert-True ($target.ExecutablePath.EndsWith('\app\ChatGPT.exe')) 'Wrong executable'
    Assert-Throws { ConvertTo-CodexRestartTarget $package @() } 'AmbiguousAppManifest'
    Assert-Throws { ConvertTo-CodexRestartTarget $package @([pscustomobject]@{ Id = 'App'; Executable = '../outside/ChatGPT.exe' }) } 'UnsafeAppExecutable'
    Assert-Throws { ConvertTo-CodexRestartTarget ([pscustomobject]@{ Name = 'Other'; PackageFamilyName = 'Other_x' }) @() } 'UnsupportedAppIdentity'
}
Test-Case 'same name in another install, unknown paths and invalid PIDs never match' {
    Assert-True (Test-CodexRestartProcess (New-FixtureProcess 11 $target.ExecutablePath.ToUpperInvariant()) $target) 'Case-insensitive exact target lost'
    Assert-True (-not (Test-CodexRestartProcess (New-FixtureProcess 23 (Join-Path $fixtureRoot 'other/ChatGPT.exe')) $target)) 'Foreign install selected'
    Assert-True (-not (Test-CodexRestartProcess (New-FixtureProcess 12 'ChatGPT.exe') $target)) 'Relative executable selected'
    Assert-True (-not (Test-CodexRestartProcess (New-FixtureProcess 0 $target.ExecutablePath) $target)) 'Invalid PID selected'
    Assert-True (-not (Test-CodexRestartProcess ([pscustomobject]@{ ProcessId = 12; ExecutablePath = $null }) $target)) 'Unreadable executable selected'
}
Test-Case 'graceful close avoids force and keeps foreign processes' {
    $fake = New-FakeRestart -Graceful $true; $result = Run-Fake $fake
    Assert-Equal $result.Forced 0 'Graceful exit was forced'
    Assert-Equal $fake.State.Closed.Count 1 'Wrong close targets'
    Assert-Equal $fake.State.Stopped.Count 0 'Unexpected stop'
    Assert-Equal $fake.State.Launches 1 'Wrong launch count'
    Assert-True (@($fake.State.Rows | Where-Object { $_.ProcessId -eq 23 }).Count -eq 1) 'Foreign process removed'
}
Test-Case 'hung GUI force-closes only the validated app before a single launch' {
    $fake = New-FakeRestart; $result = Run-Fake $fake
    Assert-Equal $result.Forced 1 'Hung app not counted'
    Assert-Equal $fake.State.Stopped.Count 1 'Wrong forced process count'
    Assert-Equal $fake.State.Stopped[0] 11 'Foreign PID stopped'
    Assert-Equal $result.Result 'app-process-running' 'Missing launch observation'
}
Test-Case 'a process that cannot stop blocks relaunch instead of creating duplicates' {
    $fake = New-FakeRestart -Unstoppable $true
    Assert-Throws { Run-Fake $fake } 'AppStillRunning'
    Assert-Equal $fake.State.Launches 0 'Relaunched a still-running app'
}
Test-Case 'an absent app is started without a close or stop request' {
    $fake = New-FakeRestart; $fake.State.Rows = @($fake.State.Rows | Where-Object { $_.ProcessId -eq 23 })
    $result = Run-Fake $fake
    Assert-Equal $result.Before 0 'Wrong initial count'
    Assert-Equal $fake.State.Closed.Count 0 'Absent app closed'
    Assert-Equal $fake.State.Stopped.Count 0 'Foreign process stopped'
    Assert-Equal $fake.State.Launches 1 'Absent app not started once'
}
Test-Case 'no observed new process is a bounded failure, never success' {
    $fake = New-FakeRestart -Starts $false
    Assert-Throws { Run-Fake $fake } 'AppLaunchNotObserved'
    Assert-Equal $fake.State.Launches 1 'Repeated launch loop'
    Assert-True ($fake.State.Waits -le 9) 'Unbounded wait'
}
Test-Case 'graceful-close errors still reach the controlled fallback' {
    $fake = New-FakeRestart; $fake.Operations.Close = { param($p, $t) throw 'WindowAlreadyGone' }
    $result = Run-Fake $fake
    Assert-Equal $result.Forced 1 'Close error blocked fallback'
}
Test-Case 'a stop race where the app exits still permits a verified relaunch' {
    $fake = New-FakeRestart; $state = $fake.State
    $fake.Operations.Stop = { param($p, $t) $state.Rows = @($state.Rows | Where-Object { $_.ProcessId -ne $p.ProcessId }); throw 'AlreadyExited' }.GetNewClosure()
    $result = Run-Fake $fake
    Assert-Equal $result.After 1 'Exit race blocked relaunch'
}
Test-Case 'PID reuse is rejected immediately before a real process operation' {
    $snapshot = New-FixtureProcess 11 $target.ExecutablePath
    function Get-CimInstance { param($ClassName, $Filter, $ErrorAction) $script:currentFixture }
    $script:currentFixture = New-FixtureProcess 11 $target.ExecutablePath
    $script:currentFixture.CreationDate = [datetime]'2026-02-01'
    Assert-True ($null -eq (Get-VerifiedCodexRestartProcess $snapshot $target)) 'Reused PID accepted'
    $script:currentFixture = New-FixtureProcess 11 $target.ExecutablePath
    Assert-True ($null -ne (Get-VerifiedCodexRestartProcess $snapshot $target)) 'Current exact process rejected'
    $script:currentFixture = New-FixtureProcess 11 (Join-Path $fixtureRoot 'other/ChatGPT.exe')
    Assert-True ($null -eq (Get-VerifiedCodexRestartProcess $snapshot $target)) 'Foreign replacement PID accepted'
}
Test-Case 'an activation error is reported and never retried indefinitely' {
    $fake = New-FakeRestart; $fake.Operations.Launch = { param($t) throw 'ActivationFailed' }
    Assert-Throws { Run-Fake $fake } 'ActivationFailed'
}
Test-Case 'the same application in another Windows session is never selected' {
    $other = New-FixtureProcess 44 $target.ExecutablePath; $other.SessionId = $target.SessionId + 1
    Assert-True (-not (Test-CodexRestartProcess $other $target)) 'Another Windows session selected'
}
Test-Case 'the real named guard rejects another worker and releases for the next run' {
    $name = 'Local\StarPlayground.RestartTest.' + [guid]::NewGuid().ToString('N')
    $guard = Enter-CodexRestartGuard $name
    try {
        $coreFile = (Join-Path $PSScriptRoot 'codex-restart-core.ps1').Replace("'", "''")
        $childCode = ". '$coreFile'; try { `$g = Enter-CodexRestartGuard '$name'; `$g.ReleaseMutex(); `$g.Dispose(); exit 1 } catch { if (`$_.Exception.Message -eq 'AnotherRestartIsAlreadyRunning') { exit 0 }; exit 2 }"
        & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -Command $childCode
        Assert-Equal $LASTEXITCODE 0 'Concurrent worker acquired the restart guard'
    } finally { $guard.ReleaseMutex(); $guard.Dispose() }
    $next = Enter-CodexRestartGuard $name; $next.ReleaseMutex(); $next.Dispose()
}
Write-Host ('SUMMARY: ' + $script:passed + ' passed; no desktop app process was closed or launched.')
