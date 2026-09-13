@echo off
setlocal
echo ========================================================
echo   GOOGLE LABS MCP - PORTABLE FFMPEG DOWNLOAD HELPER
echo ========================================================
set TOOLS_DIR=%~dp0
set FFMPEG_EXE=%TOOLS_DIR%ffmpeg.exe

if exist "%FFMPEG_EXE%" (
  echo FFmpeg is already installed at: %FFMPEG_EXE%
  goto done
)

echo Downloading portable FFmpeg via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$zipUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'; $zipPath = Join-Path $env:TEMP 'ffmpeg_essentials.zip'; Write-Host 'Downloading FFmpeg release...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath; Write-Host 'Extracting ffmpeg.exe...'; Expand-Archive -Path $zipPath -DestinationPath (Join-Path $env:TEMP 'ffmpeg_extracted') -Force; $found = Get-ChildItem -Path (Join-Path $env:TEMP 'ffmpeg_extracted') -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1; if ($found) { Copy-Item $found.FullName -Destination '%FFMPEG_EXE%' -Force; Write-Host 'Successfully installed portable FFmpeg to: %FFMPEG_EXE%'; } else { Write-Error 'Could not locate ffmpeg.exe in archive.'; } Remove-Item $zipPath -Force -ErrorAction SilentlyContinue; Remove-Item (Join-Path $env:TEMP 'ffmpeg_extracted') -Recurse -Force -ErrorAction SilentlyContinue;"

:done
echo Done! google-labs-mcp is ready for cinematic media muxing.
