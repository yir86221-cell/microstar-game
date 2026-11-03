@echo off
rem 跑家长端的 82 个单元测试和类型检查。
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

call pnpm exec vitest run
if errorlevel 1 exit /b 1

call pnpm run typecheck
