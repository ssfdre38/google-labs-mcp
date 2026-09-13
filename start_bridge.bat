@echo off
title Google Labs MCP Companion Bridge (Port 18885)
echo =========================================================
echo   GOOGLE LABS MCP - CHROME COMPANION WEBSOCKET BRIDGE
echo =========================================================
echo.
cd /d "C:\Users\admin\source\google-labs-mcp"
if exist "dist\google-labs.exe" (
  dist\google-labs.exe --bridge
) else (
  node index.js --bridge
)
pause
