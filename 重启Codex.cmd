@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\restart-codex.ps1" -Restart %*
set "restart_result=%errorlevel%"
if not "%restart_result%"=="0" pause
exit /b %restart_result%
