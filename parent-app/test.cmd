@echo off
title MicroStar parent app - tests
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo  Node.js is required: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  Installing dependencies first...
  call npm install
  if errorlevel 1 exit /b 1
)

call npm test
if errorlevel 1 goto failed

call npm run typecheck
if errorlevel 1 goto failed

echo.
echo  All tests and type checks passed.
echo.
pause
exit /b 0

:failed
echo.
echo  Something failed. Send the red lines to your AI.
echo.
pause
exit /b 1