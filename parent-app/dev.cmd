@echo off
rem 起家长端开发服务器。需要 Node.js 20+ 和 pnpm。
rem 根目录的游戏用 npm，本目录用 pnpm，两者互不影响。
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [x] 没有找到 pnpm。先运行一次：
  echo     npm install -g pnpm
  exit /b 1
)

call pnpm install
if errorlevel 1 exit /b 1

call pnpm --filter "@microstar/parent" dev
