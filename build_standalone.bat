@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ===================================================
echo [Google Labs MCP] Building Native Standalone EXE
echo ===================================================
node scripts\build_standalone.js
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Build failed with error code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)
echo.
echo [SUCCESS] Standalone binary ready at dist\google-labs.exe
