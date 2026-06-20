@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === wenshou git push helper ===

if not exist ".git" (
  echo [first run] initializing repo...
  git init
  git branch -M main
  echo.
  echo  Now create an EMPTY repo on GitHub, then run ONE of:
  echo    git remote add origin https://github.com/czha5000/pokechess.git
  echo  (replace 'wenshou' with your repo name)
  echo.
)

rem --- ensure git identity (avoids 'unable to auto-detect email') ---
git config user.email >nul 2>&1 || git config user.email "czha5000@gmail.com"
git config user.name  >nul 2>&1 || git config user.name  "chaos"

git add -A

set "msg=%~1"
if "%msg%"=="" set /p msg=Commit message (Enter for timestamp):
if "%msg%"=="" set "msg=update %date% %time%"

git commit -m "%msg%"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo.
  echo  No remote yet. Add it once, e.g.:
  echo    git remote add origin https://github.com/czha5000/pokechess.git
  echo  then re-run this script.
  pause
  exit /b
)

git push -u origin main
echo.
echo Done.
pause
