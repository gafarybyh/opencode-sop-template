@echo off
REM ============================================================
REM  OpenCode Setup - one door for everything.
REM
REM  Double-click this file for the interactive menu, or run it
REM  from a terminal with a command:
REM
REM    Setup.bat setup "C:\dev\my-app"    full setup (machine + project)
REM    Setup.bat machine                  machine layer only
REM    Setup.bat copy "C:\dev\my-app"     copy the SOP into a project
REM    Setup.bat status                   check what is present
REM
REM  The menu is a console UI: it works over RDP and in terminals
REM  without a desktop, and every menu action is scriptable.
REM ============================================================

setlocal
set "SCRIPT_DIR=%~dp0.opencode\scripts"

if not exist "%SCRIPT_DIR%\setup-menu.ps1" (
  echo [FAIL] setup-menu.ps1 not found at "%SCRIPT_DIR%"
  echo        Run this from inside the template folder.
  REM Pause only for a human. A pipe or a CI job must never block here.
  powershell -NoProfile -Command "if (-not [Console]::IsInputRedirected) { $null = Read-Host 'Press Enter to close' }"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\setup-menu.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

echo.
if "%EXITCODE%"=="0" (
  echo Setup finished.
) else (
  echo Setup finished with exit code %EXITCODE%.
)

REM Keep the window open after a double-click so the output can be read.
REM Only for a human: no command arguments and stdin not redirected.
if "%~1"=="" (
  powershell -NoProfile -Command "if (-not [Console]::IsInputRedirected) { $null = Read-Host 'Press Enter to close' }"
)

exit /b %EXITCODE%
