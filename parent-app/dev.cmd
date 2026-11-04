@echo off
title MicroStar parent app
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is required. Install Node 20 or newer:
  echo    https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  First run: installing dependencies, this takes a minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  npm install failed. Send the red lines to your AI.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  Starting the dev server...
echo  Open http://localhost:5180 on THIS computer.
echo  For a tablet, see parent-app/README.md - plain http over LAN has no Bluetooth.
echo.
call npm run dev
pause