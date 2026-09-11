@echo off
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%USERPROFILE%\.gemini\labs_chrome_profile" --remote-debugging-port=9222 "https://labs.google/fx/"
