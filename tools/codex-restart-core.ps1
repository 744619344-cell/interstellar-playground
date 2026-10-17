# Pure target validation and an injectable restart workflow. No work runs on import.
Set-StrictMode -Version 2.0

function ConvertTo-CodexRestartTarget {
    param($Package, [object[]]$Applications)
    if ($Package.Name -ne 'OpenAI.Codex' -or $Package.PackageFamilyName -notmatch '^OpenAI\.Codex_[a-z0-9]+$') {
        throw 'UnsupportedAppIdentity'
    }
    $apps = @($Applications | Where-Object { $_.Id -eq 'App' })
    if ($apps.Count -ne 1) { throw 'AmbiguousAppManifest' }
    $root = [IO.Path]::GetFullPath($Package.InstallLocation).TrimEnd('\', '/') + '\'
    $executable = [IO.Path]::GetFullPath((Join-Path $root $apps[0].Executable))
    if (-not $executable.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($executable) -notin @('ChatGPT.exe', 'Codex.exe')) { throw 'UnsafeAppExecutable' }
    [pscustomobject]@{ AppId = ($Package.PackageFamilyName + '!App'); ExecutablePath = $executable;
        SessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId }
}

function Test-CodexRestartProcess {
    param($Process, $Target)
    $number = 0
    if (-not $Process -or -not $Process.ExecutablePath -or
        -not [int]::TryParse([string]$Process.ProcessId, [ref]$number) -or $number -le 0) { return $false }
    if (-not $Process.PSObject.Properties['SessionId'] -or $Process.SessionId -ne $Target.SessionId) { return $false }
    if (-not [IO.Path]::IsPathRooted($Process.ExecutablePath)) { return $false }
    try { $path = [IO.Path]::GetFullPath($Process.ExecutablePath) } catch { return $false }
    [StringComparer]::OrdinalIgnoreCase.Equals($path, $Target.ExecutablePath)
}

function Enter-CodexRestartGuard {
    param([string]$Name = 'Local\StarPlayground.CodexRestart')
    $guard = [Threading.Mutex]::new($false, $Name)
    try {
        try { $owned = $guard.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
        if (-not $owned) { throw 'AnotherRestartIsAlreadyRunning' }
        return $guard
    } catch { $guard.Dispose(); throw }
}

function Get-CodexRestartProcesses {
    param($Target, [scriptblock]$Read)
    @(& $Read $Target | Where-Object { Test-CodexRestartProcess $_ $Target })
}

function Get-VerifiedCodexRestartProcess {
    param($Snapshot, $Target)
    if (-not (Test-CodexRestartProcess $Snapshot $Target) -or -not $Snapshot.CreationDate) { return }
    $current = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$Snapshot.ProcessId) -ErrorAction Stop
    if ($current -and (Test-CodexRestartProcess $current $Target) -and
        $current.CreationDate -eq $Snapshot.CreationDate) { $current }
}

function Invoke-CodexRestartWorkflow {
    param($Target, [hashtable]$Operations, [int]$ExitPolls = 20, [int]$LaunchPolls = 60)
    $initial = @(Get-CodexRestartProcesses $Target $Operations.Read)
    & $Operations.Log 'close-requested' $initial.Count
    foreach ($item in $initial) {
        try { & $Operations.Close $item $Target } catch { & $Operations.Log 'close-request-failed' 1 }
    }
    $remaining = @(Get-CodexRestartProcesses $Target $Operations.Read)
    for ($i = 0; $i -lt $ExitPolls -and $remaining.Count; $i++) {
        & $Operations.Wait
        $remaining = @(Get-CodexRestartProcesses $Target $Operations.Read)
    }
    $forced = $remaining.Count
    & $Operations.Log 'force-close' $forced
    foreach ($item in $remaining) {
        try { & $Operations.Stop $item $Target } catch { & $Operations.Log 'stop-request-failed' 1 }
    }
    for ($i = 0; $i -lt 4; $i++) {
        $remaining = @(Get-CodexRestartProcesses $Target $Operations.Read)
        if (-not $remaining.Count) { break }
        & $Operations.Wait
    }
    if ($remaining.Count) { throw 'AppStillRunning' }
    & $Operations.Log 'launch-requested' 1
    & $Operations.Launch $Target
    for ($i = 0; $i -lt $LaunchPolls; $i++) {
        $running = @(Get-CodexRestartProcesses $Target $Operations.Read)
        if ($running.Count) {
            & $Operations.Log 'app-process-running' $running.Count
            return [pscustomobject]@{ Result = 'app-process-running'; Before = $initial.Count; Forced = $forced; After = $running.Count }
        }
        & $Operations.Wait
    }
    throw 'AppLaunchNotObserved'
}
