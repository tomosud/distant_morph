@echo off
setlocal
cd /d "%~dp0"
set PORT=8000
:check
netstat -ano | findstr ":%PORT% " >nul
if %errorlevel%==0 (
  set /a PORT+=1
  goto check
)
start "" http://localhost:%PORT%
python -m http.server %PORT%
