@echo off
rem Serves the studio on http://localhost:5173 and opens it.
rem A server is needed because the preview iframe has to be same-origin;
rem opening index.html straight off the disk will not work in Chrome.

cd /d "%~dp0"

where py >nul 2>nul && (
  start "" http://localhost:5173/
  py tools\serve.py 5173
  goto :eof
)
where python >nul 2>nul && (
  start "" http://localhost:5173/
  python tools\serve.py 5173
  goto :eof
)

echo Python was not found on PATH.
echo Install Python from https://python.org, or serve this folder with any
echo static file server, e.g.:  npx serve -l 5173
pause
